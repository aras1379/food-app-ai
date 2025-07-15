require('dotenv').config(); 
const express = require('express');
const axios = require('axios');
const cors = require('cors'); 

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const MODEL_NAME = process.env.MODEL_NAME || 'llama3';
const PORT = process.env.PORT || 3001; 

const app = express(); 

app.use(cors());
app.use(express.json());

// === Recipe Request Body Validator // 

function validateRecipeRequest(body){
    return body && typeof body.diet === 'string' && typeof body.protein === 'string';
}

// === Main Recipe Generation Endpoint // 
app.post('/generate-recipes', async(req, res) => {
    if(!validateRecipeRequest(req.body)){
        return res.status(400).json({ error: 'diet and protein fields are required.'}); 
    }

    //unpack user diet
    const{diet, protein, preferences = [], research = ""} = req.body; 

    //dynamically build prompt 
    let prompt = `
    Your are an expert dietician and chef. Respond ONLY in valid JSON. 
    Provide 5-7 recipes. 
    Structure your response as: 
    {
        "category": "${diet} recipes",
        "protein": "${protein}",
        "mealType": "${preferences.join(', ')}",
        "researchSummery": "${research}",
        "recipes": [
            {
                "title": "Title",
                "ingredients": ["item1", "item2" ],
                "steps": ["step1", "step2"], 
                "nutrition": {
                    "calories": "...",
                    "protein_g": "...",
                    "fat_g": "...",
                    "carbs_g": "...",
                    "vitamins": [ "A", "B", ... ]
                }
            }
        ]
    }
        DO NOT output anything except this JSON. 
    ` ;

    try{
        const response = await axios.post(OLLAMA_URL, {
            model: MODEL_NAME,
            prompt: prompt,
            stream: false
        }, {timeout: 90000});
        let recipesJson = null; 
        try{
            recipesJson = JSON.parse(response.data.response.trim());
        }
        catch(e){
            return res.status(500).json({ error: "LLM did not return valid JSON", raw: response.data.response });
        }
        return res.json(recipesJson);
    }
    catch(error){
        console.error('Ollama API error:', error?.response?.data || error.message);
        return res.status(500).json({error: 'Failed to generate recipes', detail: error?.message});
    }
    });

// ==== Health Check == 
app.get('/health', (req, res)=> {
    res.json({status: 'ok', llamaModel: MODEL_NAME});
}); 

// ==== Start server 
app.listen(PORT, () => {
    console.log(`Recipe AI backend running on port ${PORT}`)
}); 