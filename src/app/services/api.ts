export const API_BASE_URL = '/api';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Extract user info to track in backend for audit logs
  let userName = 'Unknown Device';
  try {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      const user = JSON.parse(userStr);
      userName = user.name || user.username || 'System User';
    }
  } catch (e) {
    // Ignore error
  }

  // Ensure headers object exists and append username
  const headers = new Headers(options.headers || {});
  headers.set('X-User-Name', userName);
  options.headers = headers;

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new Error((data && data.message) || response.statusText || 'API Error');
    }
    
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};
