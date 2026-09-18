import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { connectDatabase, closeDatabase } from '../../src/config/database';
import { getUsersCollection } from '../../src/models/user.model';
import { getProjectsCollection, Project } from '../../src/models/project.model';
import { authService } from '../../src/services/auth.service';
import { projectService } from '../../src/services/project.service';
import { authenticate } from '../../src/middleware/auth.middleware';

interface AuthResult {
  next: boolean;
  status?: number;
  body?: any;
}

function runAuth(req: any): Promise<AuthResult> {
  return new Promise(resolve => {
    const res: any = {
      status(code: number) {
        this._status = code;
        return this;
      },
      json(payload: any) {
        resolve({ next: false, status: this._status || 200, body: payload });
        return this;
      },
    };
    authenticate(req, res, () => resolve({ next: true }));
  });
}

const suffix = Date.now().toString(36);
const projectAId = new ObjectId();
const projectBId = new ObjectId();
const userAId = new ObjectId();
const userBId = new ObjectId();

let tokenA = '';
let tokenB = '';

function makeProject(id: ObjectId, name: string): Project {
  return {
    _id: id,
    name,
    slug: `${name.toLowerCase()}-${suffix}`,
    config: {
      channels: { whatsapp: true, instagram: false, web: true },
      messages: { welcome: 'hola', goodbye: 'adios' },
      options: { autoCreateContact: true },
    },
    createdBy: userAId,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

before(async () => {
  await connectDatabase();

  await getProjectsCollection().insertMany([
    makeProject(projectAId, `Proyecto A ${suffix}`),
    makeProject(projectBId, `Proyecto B ${suffix}`),
  ]);

  const password = await bcrypt.hash('test1234', 4);
  const userA: any = {
    _id: userAId,
    name: 'User A',
    email: `usera-${suffix}@test.io`,
    password,
    role: 'admin',
    status: 'Active',
    projectIds: [projectAId],
    activeProjectId: projectAId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const userB: any = {
    _id: userBId,
    name: 'User B',
    email: `userb-${suffix}@test.io`,
    password,
    role: 'admin',
    status: 'Active',
    projectIds: [projectBId],
    activeProjectId: projectBId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await getUsersCollection().insertMany([userA, userB]);

  tokenA = authService.generateToken(userA);
  tokenB = authService.generateToken(userB);
});

after(async () => {
  await getUsersCollection().deleteMany({ _id: { $in: [userAId, userBId] } });
  await getProjectsCollection().deleteMany({ _id: { $in: [projectAId, projectBId] } });
  await closeDatabase();
});

test('sin header usa el proyecto activo del usuario', async () => {
  const req: any = { headers: { authorization: `Bearer ${tokenA}` } };
  const result = await runAuth(req);
  assert.equal(result.next, true);
  assert.equal(req.projectId, projectAId.toString());
});

test('header propio resuelve ese proyecto', async () => {
  const req: any = {
    headers: { authorization: `Bearer ${tokenA}`, 'x-project-id': projectAId.toString() },
  };
  const result = await runAuth(req);
  assert.equal(result.next, true);
  assert.equal(req.projectId, projectAId.toString());
});

test('header de un proyecto ajeno responde error de permisos', async () => {
  const req: any = {
    headers: { authorization: `Bearer ${tokenA}`, 'x-project-id': projectBId.toString() },
  };
  const result = await runAuth(req);
  assert.equal(result.next, false);
  assert.equal(result.status, 403);
});

test('proyectos del usuario quedan aislados', async () => {
  const userA = await getUsersCollection().findOne({ _id: userAId });
  const projectsA = await projectService.getUserProjects(userA!.projectIds || []);
  assert.equal(projectsA.length, 1);
  assert.equal(projectsA[0]._id!.toString(), projectAId.toString());

  const activeA = await projectService.getActiveProject(userA);
  assert.equal(activeA?._id?.toString(), projectAId.toString());
});

test('cada usuario solo ve su propio proyecto', async () => {
  const userB = await getUsersCollection().findOne({ _id: userBId });
  const projectsB = await projectService.getUserProjects(userB!.projectIds || []);
  assert.equal(projectsB.length, 1);
  assert.equal(projectsB[0]._id!.toString(), projectBId.toString());

  const req: any = { headers: { authorization: `Bearer ${tokenB}` } };
  const result = await runAuth(req);
  assert.equal(result.next, true);
  assert.equal(req.projectId, projectBId.toString());
});
