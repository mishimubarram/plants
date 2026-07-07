export const identifyPlant = async (imageBase64: string) => {
  const response = await fetch('/api/gemini/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to identify plant');
  }
  return response.json();
};

export const getPlantAssistantResponse = async (
  history: { role: 'user' | 'model'; content: string }[],
  message: string
) => {
  const response = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history, message }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to get assistant response');
  }
  const data = await response.json();
  return data.text;
};

export const getPlantHealthAdvice = async (imageBase64: string) => {
  const response = await fetch('/api/gemini/health-advice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to get plant health advice');
  }
  return response.json();
};

export const diagnosePlant = async (imageBase64: string) => {
  const response = await fetch('/api/gemini/diagnose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to diagnose plant');
  }
  return response.json();
};

export const getPlantCareGuide = async (plantName: string) => {
  const response = await fetch('/api/gemini/care-guide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plantName }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to get plant care guide');
  }
  return response.json();
};

export const getSeasonalTips = async (lat: number, lng: number, date: string) => {
  const response = await fetch('/api/gemini/seasonal-tips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng, date }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to get seasonal tips');
  }
  return response.json();
};

export const getLocalPlantsKnowledge = async (lat: number, lng: number) => {
  const response = await fetch('/api/gemini/local-knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to get local plants knowledge');
  }
  return response.json();
};
