import { request } from '@/utils';

export type DeleteWorkspaceReq = {
  userName: string;
  workspaceId: string;
};

export async function deleteWorkspace(params: DeleteWorkspaceReq) {
  return request
    .post<boolean>(`/report/filesystem/deleteWorkspace`, params)
    .then((res) => res.body);
}
