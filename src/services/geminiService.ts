import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const identifyPlant = async (imageBase64: string) => {
  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: imageBase64,
    },
  };
  const textPart = {
    text: `Identify this plant and provide detailed care instructions in JSON format. 
    Include: name, scientificName, description, careInstructions (watering, sunlight, temperature, soil), and wateringFrequencyDays (a number).`,
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [imagePart, textPart] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          scientificName: { type: Type.STRING },
          description: { type: Type.STRING },
          careInstructions: {
            type: Type.OBJECT,
            properties: {
              watering: { type: Type.STRING },
              sunlight: { type: Type.STRING },
              temperature: { type: Type.STRING },
              soil: { type: Type.STRING },
            },
          },
          wateringFrequencyDays: { type: Type.NUMBER },
        },
        required: ["name", "scientificName", "description", "careInstructions", "wateringFrequencyDays"],
      },
    },
  });

  return JSON.parse(response.text);
};

export const getPlantAssistantResponse = async (history: { role: "user" | "model"; content: string }[], message: string) => {
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: `You are Botanic AI, a professional gardening assistant. 
      Your goal is to provide helpful, accurate, and easy-to-understand advice about plant care, identification, and gardening.
      
      Guidelines for your responses:
      - Use clear, structured Markdown (headings, bullet points, bold text).
      - Keep explanations simple but informative.
      - If a plant is in bad condition, provide a step-by-step recovery plan.
      - Be encouraging and friendly.
      - Use emojis to make the text more engaging.
      - If you don't know something, be honest and suggest where to find the info.`,
    },
    history: history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
  });

  const response = await chat.sendMessage({ message });
  return response.text;
};

export const getPlantHealthAdvice = async (imageBase64: string) => {
  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: imageBase64,
    },
  };
  const textPart = {
    text: `Analyze this plant photo. The user wants to know how to improve the health of this plant. 
    Look for dust, dirt, pests, or signs of poor health. 
    Provide a detailed care plan including cleaning instructions and general maintenance.
    Return in JSON format.`,
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [imagePart, textPart] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          healthStatus: { type: Type.STRING },
          cleaningTips: { type: Type.STRING },
          maintenancePlan: { type: Type.ARRAY, items: { type: Type.STRING } },
          recoverySteps: { type: Type.ARRAY, items: { type: Type.STRING } },
          urgency: { type: Type.STRING, enum: ["low", "medium", "high"] },
        },
        required: ["healthStatus", "cleaningTips", "maintenancePlan", "recoverySteps", "urgency"],
      },
    },
  });

  return JSON.parse(response.text);
};

export const diagnosePlant = async (imageBase64: string) => {
  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: imageBase64,
    },
  };
  const textPart = {
    text: `Analyze this plant photo for diseases or pests. Provide a diagnosis and suggest appropriate organic and chemical treatment methods. 
    Return in JSON format.`,
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [imagePart, textPart] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          diagnosis: { type: Type.STRING },
          symptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
          organicTreatment: { type: Type.STRING },
          chemicalTreatment: { type: Type.STRING },
          prevention: { type: Type.STRING },
        },
        required: ["diagnosis", "symptoms", "organicTreatment", "chemicalTreatment", "prevention"],
      },
    },
  });

  return JSON.parse(response.text);
};

export const getPlantCareGuide = async (plantName: string) => {
  const prompt = `Provide a detailed care guide for the plant: ${plantName}. 
  Include: name, category (Indoor, Outdoor, Succulent, etc.), light (e.g., Bright Indirect), water (e.g., Once a week), detail (a brief description), and img (a placeholder image URL from picsum.photos/seed/${plantName.replace(/\s+/g, '')}/800/600).
  Return in JSON format.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          category: { type: Type.STRING },
          light: { type: Type.STRING },
          water: { type: Type.STRING },
          detail: { type: Type.STRING },
          img: { type: Type.STRING },
        },
        required: ["name", "category", "light", "water", "detail", "img"],
      },
    },
  });

  return JSON.parse(response.text);
};

export const getSeasonalTips = async (lat: number, lng: number, date: string) => {
  const prompt = `Based on the location (lat: ${lat}, lng: ${lng}) and the date (${date}), provide 3 seasonal gardening tips for planting, maintenance, and harvesting. 
  Return in JSON format as an array of objects with 'title', 'category' (planting, maintenance, or harvesting), and 'advice'.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING, enum: ["planting", "maintenance", "harvesting"] },
            advice: { type: Type.STRING },
          },
          required: ["title", "category", "advice"],
        },
      },
    },
  });

  return JSON.parse(response.text);
};

export const getLocalPlantsKnowledge = async (lat: number, lng: number) => {
  const prompt = `Based on the location (lat: ${lat}, lng: ${lng}), list 5 common native or popular plants in this area. Provide a brief description and care tip for each. Return in JSON format as an array of objects with 'name', 'description', and 'careTip'.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            careTip: { type: Type.STRING },
          },
          required: ["name", "description", "careTip"],
        },
      },
    },
  });

  return JSON.parse(response.text);
};
