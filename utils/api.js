const BASE_URL = "http://192.168.1.125:5000/api"; // your backend URL

export const getSignals = async () => {
  try {
    const response = await fetch(`${BASE_URL}/signals`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
  }
};



