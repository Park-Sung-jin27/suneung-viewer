import { supabase } from './supabase.js';

export async function fetchMaster(query, userId, signal) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
  const response = await fetch(`/api/eng-math-master${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` }, signal, cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 403) throw new Error('이 계정에는 마스터 열람 권한이 없습니다.');
    if (response.status === 401) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    throw new Error('자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  return response;
}
