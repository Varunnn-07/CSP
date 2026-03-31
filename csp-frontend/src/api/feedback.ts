import { api } from './client';

export type FeedbackItem = {
  id: string;
  user_id: string;
  service_name: string;
  message: string;
  rating: number;
  created_at: string;
  updated_at: string;
};

type FeedbackListResponse = {
  success: boolean;
  data: FeedbackItem[];
};

type FeedbackOneResponse = {
  success: boolean;
  data: FeedbackItem;
};

export type CreateFeedbackPayload = {
  service_name: string;
  rating: number;
  message: string;
};

export async function getMyFeedback() {
  const { data } = await api.get<FeedbackListResponse>('/feedback');
  return data;
}

export async function createFeedback(payload: CreateFeedbackPayload) {
  const { data } = await api.post<FeedbackOneResponse>('/feedback', payload);
  return data;
}
