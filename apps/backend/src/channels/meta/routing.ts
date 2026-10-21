import { ObjectId } from 'mongodb';
import { getProjectsCollection } from '../../models/project.model';

/** Dónde guarda cada canal de Meta la cuenta del proyecto y qué interruptor lo habilita. */
const ACCOUNT_FIELDS = {
  whatsapp: 'config.whatsapp.phoneNumberId',
  instagram: 'config.instagram.accountId',
} as const;

export type MetaChannel = keyof typeof ACCOUNT_FIELDS;

/** Proyecto dueño de una cuenta del canal, solo si tiene el canal habilitado. */
export async function projectForAccount(channel: MetaChannel, account: string) {
  const project = await getProjectsCollection().findOne(
    { [ACCOUNT_FIELDS[channel]]: account },
    { projection: { _id: 1, [`config.channels.${channel}`]: 1 } },
  );
  return project?.config?.channels?.[channel] ? project._id.toString() : undefined;
}

/** Una cuenta de un canal solo puede atenderla un proyecto. */
export async function isAccountTaken(channel: MetaChannel, account: string, exceptProjectId: string) {
  const other = await getProjectsCollection().findOne(
    { [ACCOUNT_FIELDS[channel]]: account, _id: { $ne: new ObjectId(exceptProjectId) } },
    { projection: { _id: 1 } },
  );
  return !!other;
}
