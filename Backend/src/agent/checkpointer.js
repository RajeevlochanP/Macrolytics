import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import dotenv from 'dotenv';

dotenv.config();

export const getCheckpointer = async () => {
  const connString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
  
  const checkpointer = PostgresSaver.fromConnString(connString);
  await checkpointer.setup(); // Ensures tables exist
  return checkpointer;
};
