import sys
with open('frontend/src/api/client.ts', 'a', encoding='utf-8') as f:
    f.write("\nexport const getApprovalsDistribution = async (as_of: string, compare: string | null = null, exclude_deleted_lost: boolean = false) => {\n  const params: any = { as_of, exclude_deleted_lost }\n  if (compare) params.compare = compare\n  return api.get('/v2/approvals/distribution', { params }).then(r => r.data)\n}\n")
