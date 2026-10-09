with open('frontend/src/api/client.ts', 'a', encoding='utf-8') as f:
    f.write('''
export const getApprovalsDeals = async (as_of: string, status?: string, category?: string, exclude_deleted_lost: boolean = false) => {
  const params: any = { as_of, exclude_deleted_lost }
  if (status) params.status = status
  if (category) params.category = category
  return api.get('/v2/approvals/deals', { params }).then(r => r.data)
}
''')
