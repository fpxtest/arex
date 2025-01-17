import { request } from '@/utils';

export type ImportCollectionReq = {
  workspaceId: string;
  type: number;
  path: string[];
  importString: string;
};

export async function importCollection(params: ImportCollectionReq) {
  return request
    .post<{ success: boolean }>(`/report/filesystem/import`, params)
    .then((res) => res.body.success);
}
