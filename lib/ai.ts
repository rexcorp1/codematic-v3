
import { GoogleGenAI } from "@google/genai";
import { FileNode, Attachment } from '../types';
import { formatProjectStructureForAI } from './project-utils';

export interface AiFile {
    path: string;
    content: string;
}

export interface AiResponse {
    summary: string;
    filesToUpdate?: AiFile[];
    filesToDelete?: AiFile[];
}

const parseAiResponse = (responseText: string): AiResponse => {
    const summaryMatch = responseText.match(/<summary>([\s\S]*?)<\/summary>/);
    const summary = summaryMatch ? summaryMatch[1].trim() : "No summary provided.";

    const filesToUpdate: AiFile[] = [];
    const updateMatches = responseText.matchAll(/<update file="([^"]+)">([\s\S]*?)<\/update>/g);
    for (const match of updateMatches) {
        filesToUpdate.push({ path: match[1], content: match[2] || '' });
    }
    
    const filesToDelete: AiFile[] = [];
    const deleteMatches = responseText.matchAll(/<delete file="([^"]+)"\s*\/?>/g);
    for (const match of deleteMatches) {
        filesToDelete.push({ path: match[1], content: '' });
    }
    
    if (filesToUpdate.length === 0 && filesToDelete.length === 0 && !summaryMatch) {
         if (!responseText.trim().startsWith('<')) {
            return { summary: responseText.trim(), filesToUpdate, filesToDelete };
         }
    }

    return { summary, filesToUpdate, filesToDelete };
};


export const generateCodeFromPrompt = async (
    prompt: string,
    projectStructure: FileNode[],
    attachments: Attachment[]
): Promise<AiResponse | null> => {
    
    if (!import.meta.env.VITE_API_KEY) {
        console.error("VITE_API_KEY environment variable not set.");
        return { summary: "Error: API key is not configured. Please set the VITE_API_KEY environment variable." };
    }

    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
    
    const projectContext = formatProjectStructureForAI(projectStructure);

    const systemInstruction = `You are an expert web developer AI assistant.
Your task is to help the user build and modify a web application based on their prompts.
The user's project structure and file contents are provided below.

When the user asks for changes, you MUST respond in the following format:
1.  A summary of the changes you are making, enclosed in <summary> tags.
2.  For each file you need to create or update, provide the full path and the complete new content of the file, enclosed in <update file="path/to/file.tsx">...</update> tags.
3.  For each file you need to delete, use an empty <delete file="path/to/file.ts" /> tag.

Example response:
<summary>
I've updated the App component to add a new button and removed the unused CSS file.
</summary>
<update file="/src/App.tsx">
import React from 'react';

function App() {
  return (
    <div>
      <h1>Hello World</h1>
      <button>New Button</button>
    </div>
  );
}

export default App;
</update>
<delete file="/src/unused.css" />

IMPORTANT RULES:
- ALWAYS provide the FULL content for any file you are updating. Do not use placeholders or comments like "... rest of the code".
- Ensure the file paths are correct and start with a '/'.
- If the user provides attachments, analyze them and incorporate them into your response.
- If you are only providing information or answering a question, just provide the text response inside the <summary> tag and omit the update/delete tags.
- Do not add any text outside of the specified XML tags.
`;
    
    const fullPrompt = `${projectContext}\n\nUser prompt: ${prompt}`;
    
    const promptParts: any[] = [{ text: fullPrompt }];

    for (const attachment of attachments) {
        if (attachment.mimeType.startsWith('image/')) {
            const base64Data = attachment.content.split(',')[1] || attachment.content;
            promptParts.push({
                inlineData: {
                    mimeType: attachment.mimeType,
                    data: base64Data
                }
            });
        } else {
            promptParts[0].text += `\n\n--- ATTACHED FILE: ${attachment.name} ---\n${attachment.content}\n--- END OF ATTACHED FILE ---\n`;
        }
    }
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: promptParts },
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.1,
            }
        });

        const responseText = response.text;
        
        if (!responseText) {
            console.error("Gemini API returned an empty response.");
            return { summary: "The AI returned an empty response. Please try again." };
        }

        return parseAiResponse(responseText);

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return { summary: `An error occurred while communicating with the AI. Error: ${error instanceof Error ? error.message : String(error)}` };
    }
};

export const generateProjectFromIdea = async (idea: string): Promise<AiFile[] | null> => {
    if (!import.meta.env.VITE_API_KEY) {
        console.error("VITE_API_KEY environment variable not set.");
        throw new Error("Error: API key is not configured. Please set the VITE_API_KEY environment variable.");
    }

    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

    const systemInstruction = `You are an expert full-stack web developer AI. Your task is to generate a complete, runnable starter project based on the user's idea. The project should be a Vite + React + TypeScript application.

You MUST respond ONLY with a series of \`<update file="path/to/file">...</update>\` tags. Each tag must contain the full and complete content for that file.
The project MUST include all necessary files to be runnable, including:
- \`/package.json\` (with dependencies like react, react-dom, and devDependencies like vite, @vitejs/plugin-react, typescript)
- \`/vite.config.ts\`
- \`/index.html\`
- A complete \`/src\` directory with all necessary source files (\`main.tsx\`, \`App.tsx\`, etc.).

Do NOT include a \`<summary>\` tag or any other explanatory text outside of the file content. Your entire response should be only the \`<update>\` tags.
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `Project Idea: ${idea}` }] },
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.2,
            }
        });

        const responseText = response.text;
        if (!responseText) {
            console.error("Gemini API returned an empty response for project generation.");
            return null;
        }

        const filesToUpdate: AiFile[] = [];
        const updateMatches = responseText.matchAll(/<update file="([^"]+)">([\s\S]*?)<\/update>/g);
        for (const match of updateMatches) {
            filesToUpdate.push({ path: match[1], content: match[2].trim() || '' });
        }
        
        if (filesToUpdate.length === 0) {
            console.error("AI response did not contain valid <update> tags for project generation.");
            return null;
        }

        return filesToUpdate;

    } catch (error) {
        console.error("Error calling Gemini API for project generation:", error);
        throw new Error(`AI failed to generate project. ${error instanceof Error ? error.message : ''}`);
    }
};
