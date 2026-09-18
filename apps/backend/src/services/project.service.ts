import { ObjectId } from 'mongodb';
import { getProjectsCollection, Project } from '../models/project.model';
import { agentService } from './agent.service';

export const projectService = {
  async findBySlug(slug: string) {
    return getProjectsCollection().findOne({ slug, status: 'active' });
  },
  /** Verifica si ya existe algún proyecto */
  async hasProject(): Promise<boolean> {
    const count = await getProjectsCollection().countDocuments();
    return count > 0;
  },

  /** Obtiene los proyectos a los que pertenece un usuario */
  async getUserProjects(projectIds: (ObjectId | string)[] = []): Promise<Project[]> {
    const ids = projectIds
      .map(id => id.toString())
      .filter(id => ObjectId.isValid(id))
      .map(id => new ObjectId(id));
    if (ids.length === 0) return [];
    return getProjectsCollection()
      .find({ _id: { $in: ids } })
      .sort({ createdAt: 1 })
      .toArray();
  },

  /**
   * Obtiene el proyecto activo de un usuario.
   * Sin usuario (o sin `activeProjectId`) no hay contexto global de proyecto.
   */
  async getActiveProject(user?: { activeProjectId?: ObjectId | string } | null) {
    if (!user?.activeProjectId) return null;
    return this.findById(user.activeProjectId.toString());
  },

  /** Obtiene un proyecto por ID */
  async findById(id: string) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    return getProjectsCollection().findOne({ _id: new ObjectId(id) });
  },

  /**
   * Crea un proyecto y automáticamente crea el agente asociado.
   * No hay restricción de proyecto único: cada usuario puede tener varios.
   */
  async create(data: {
    name: string;
    slug?: string;
    description?: string;
    logo?: string;
    agent: {
      name: string;
      description?: string;
      model: string;
      personality?: any;
      enableWelcomeGreeting?: boolean;
      enableGoodbyeMessage?: boolean;
      enableFallbackAdvisor?: boolean;
      goodbyeKeywords?: string[];
      temperature?: number;
      maxTokens?: number;
    };
    config?: Partial<Project['config']>;
    createdBy: string;
  }) {
    const projectsColl = getProjectsCollection();

    const projectId = new ObjectId();

    // 1. Crear el agente primero, vinculado al proyecto
    const agent = await agentService.create({
      name: data.agent.name,
      description: data.agent.description || '',
      model: data.agent.model,
      personality: data.agent.personality,
      status: 'active',
      projectId,
      createdBy: new ObjectId(data.createdBy),
      config: {
        temperature: data.agent.temperature ?? 0.7,
        maxTokens: data.agent.maxTokens ?? 300,
        enableWelcomeGreeting: data.agent.enableWelcomeGreeting ?? false,
        enableGoodbyeMessage: data.agent.enableGoodbyeMessage ?? false,
        enableFallbackAdvisor: data.agent.enableFallbackAdvisor ?? false,
        goodbyeKeywords: data.agent.goodbyeKeywords,
        enableWhatsApp: data.config?.channels?.whatsapp ?? true,
        enableInstagram: data.config?.channels?.instagram ?? false,
        enableWeb: data.config?.channels?.web ?? true,
        autoCreateContact: data.config?.options?.autoCreateContact ?? true,
      },
    } as any);

    // 2. Crear el proyecto con referencia al agente
    const baseSlug = data.slug ? this.slugify(data.slug) : this.slugify(data.name);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const newProject: Project = {
      _id: projectId,
      name: data.name,
      slug,
      description: data.description || '',
      logo: data.logo,
      agentId: agent._id,
      config: {
        channels: {
          whatsapp: data.config?.channels?.whatsapp ?? true,
          instagram: data.config?.channels?.instagram ?? false,
          web: data.config?.channels?.web ?? true,
        },
        messages: {
          welcome: data.config?.messages?.welcome || '¡Hola! ¿En qué puedo ayudarte?',
          goodbye: data.config?.messages?.goodbye || '¡Gracias por tu consulta! Hasta pronto.',
        },
        options: {
          autoCreateContact: data.config?.options?.autoCreateContact ?? true,
        },
      },
      createdBy: new ObjectId(data.createdBy),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await projectsColl.insertOne(newProject);

    return { project: newProject, agent };
  },

  /** Actualiza un proyecto */
  async update(id: string, data: Partial<Pick<Project, 'name' | 'slug' | 'description' | 'logo' | 'config'>>) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');

    const result = await getProjectsCollection().findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
  },

  slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 64);
  },

  async ensureUniqueSlug(baseSlug: string) {
    const projectsColl = getProjectsCollection();
    let slug = baseSlug || `project-${Date.now()}`;
    let counter = 1;

    while (await projectsColl.findOne({ slug })) {
      counter += 1;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  },
};
