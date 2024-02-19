import { ChromeSyncDataDTO } from "./globals";

const PROTO = (process.env.REACT_APP_PROTO) ? process.env.REACT_APP_PROTO : "https"
export const ENDPOINT = `${PROTO}://${process.env.REACT_APP_ENDPOINT}`
const API_KEY = process.env.REACT_APP_API_KEY


export const getRemoteData = async (): Promise<any> => {
  const headers = new Headers({
    "Accept": "application/json",
    "Content-Type": "application/json",
    "api-key": `${API_KEY}`
  })
  const options: RequestInit = {
    credentials: 'same-origin',
    headers: headers
  }
  let response = await fetch(ENDPOINT, options);
  response = await response.json();
  return response;
};

export const updateRemoteData = async (data: ChromeSyncDataDTO): Promise<any> => {
  const headers = new Headers({
    "Accept": "application/json",
    "Content-Type": "application/json",
    "api-key": `${API_KEY}`
  })
  const options: RequestInit = {
    method: "POST",
    credentials: 'same-origin',
    headers: headers,
    body: JSON.stringify(data),
  };
  return await fetch(ENDPOINT, options);
};
