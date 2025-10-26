// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://us-central1-eventu-1b077.cloudfunctions.net/api';

// Helper function to make authenticated requests
export async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Get auth token from Firebase
  const { auth } = await import('./firebase');
  const token = await auth.currentUser?.getIdToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

