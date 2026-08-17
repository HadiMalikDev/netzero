"use server";

import { requireUser } from "@/lib/auth/session";
import { getProject } from "@/lib/data";
import { answerQuestion, type Answer } from "@/lib/assistant/answer";

export async function ask(
  projectId: string,
  question: string,
): Promise<Answer> {
  await requireUser();
  const project = await getProject(projectId);
  if (!project) throw new Error("project not found");
  return answerQuestion(projectId, project.name, question.trim());
}
