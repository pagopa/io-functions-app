/**
 * Get Messages
 */
export const getMessages = (nodeFetch: typeof fetch, baseUrl: string) => async (
  fiscalCode?: string
): Promise<Response> => nodeFetch(`${baseUrl}/api/v1/messages/${fiscalCode}`);
/**
 * Get Messages
 */
export const getMessagesWithEnrichment = (
  nodeFetch: typeof fetch,
  baseUrl: string
) => async (
  fiscalCode?: string,
  page_size?: number,
  maximum_id?: number
): Promise<Response> =>
  nodeFetch(
    `${baseUrl}/api/v1/messages/${fiscalCode}?enrich_result_data=true&page_size=${page_size}&maximum_id=${maximum_id}`
  );
