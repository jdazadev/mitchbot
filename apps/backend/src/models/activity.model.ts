import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export interface Activity {
  _id?: ObjectId;
  projectId?: ObjectId;
  type:
    | "lead_captured"
    | "bot_handoff"
    | "campaign_sent"
    | "new_contact"
    | "conversation_closed"
    | "conversation_created"
    | "tool_executed";
  title: string;
  detail: string;
  icon: string;
  color: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export const getActivitiesCollection = () => {
    return getDatabase().collection<Activity>('activities');
};
