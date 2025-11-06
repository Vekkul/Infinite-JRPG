import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Player, Enemy, GameAction, Item, ItemType, EnemyAbility, CharacterClass, SocialEncounter, RewardType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const SYSTEM_INSTRUCTION = "You are a creative and engaging dungeon master for a classic fantasy JRPG. Your descriptions are vivid, your monsters are menacing, and your scenarios are intriguing. Keep the tone epic and adventurous, with a slightly retro feel. Responses must adhere to the provided JSON schema.";

const itemSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "The name of the item, e.g., 'Minor Healing Potion', 'Bubbling Concoction'." },
        description: { type: Type.STRING, description: "A brief, flavorful description of the item." },
        type: { type: Type.STRING, description: `The item type. Must be '${ItemType.POTION}'.` },
        value: { type: Type.INTEGER, description: "For potions, the amount of HP it restores. Between 15 and 30." },
        stackLimit: { type: Type.INTEGER, description: "The maximum stack size for this item. For potions, this should be between 5 and 10."}
    },
    required: ["name", "description", "type", "value", "stackLimit"]
};

const sceneSchema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description: "A vivid, fantasy JRPG-style description of the current location. Max 80 words. Be creative and evocative. Mention things like weather, terrain, and mood.",
    },
    actions: {
      type: Type.ARRAY,
      description: "An array of 3 possible actions for the player. One should be 'rest', one should be an 'encounter' (like 'Challenge the guardian'), and one should be 'explore'. Occasionally, include a 'social' action type instead of explore or encounter.",
      items: {
        type: Type.OBJECT,
        properties: {
          label: {
            type: Type.STRING,
            description: "The text on the action button, e.g., 'Venture into the Whispering Woods'.",
          },
          type: {
            type: Type.STRING,
            description: "The type of action. Must be one of: 'explore', 'rest', 'encounter', 'social'. Ensure a good mix of types.",
          },
        },
        required: ["label", "type"],
      },
    },
    foundItem: {
      ...itemSchema,
      description: "An item the player finds in this scene. Optional, only include it about 25% of the time."
    }
  },
  required: ["description", "actions"],
};

const enemySchema = {
    type: Type.OBJECT,
    properties: {
        name: {
            type: Type.STRING,
            description: "A creative and menacing fantasy monster name from a JRPG. e.g. 'Gloomfang', 'Crystal Golem', 'Shadow Sprite'."
        },
        description: {
            type: Type.STRING,
            description: "A short, intimidating description of the monster. Max 30 words."
        },
        hp: {
            type: Type.INTEGER,
            description: "The monster's health points. Should be a value between player's level * 15 and player's level * 25."
        },
        attack: {
            type: Type.INTEGER,
            description: "The monster's attack power. Should be a value between player's level * 3 and player's level * 5."
        },
        loot: {
            ...itemSchema,
            description: "An item dropped by the monster upon defeat. Optional, include for about 40% of monsters."
        },
        ability: {
            type: Type.STRING,
            description: `An optional special ability for the monster. Can be one of: '${EnemyAbility.HEAL}', '${EnemyAbility.SHIELD}', '${EnemyAbility.MULTI_ATTACK}', '${EnemyAbility.DRAIN_LIFE}'. Omit for most monsters.`
        }
    },
    required: ["name", "description", "hp", "attack"]
};

const encounterSchema = {
    type: Type.ARRAY,
    description: "An array of 1 to 3 enemy monsters for the player to fight.",
    items: enemySchema,
};

const rewardSchema = {
    type: Type.OBJECT,
    properties: {
        type: { type: Type.STRING, description: `The type of reward. Must be one of: '${RewardType.XP}', '${RewardType.ITEM}'.` },
        value: { type: Type.INTEGER, description: "For XP, the amount gained. Between 25 and 75." },
        item: { ...itemSchema, description: "For an ITEM reward, describe the item."}
    },
    required: ["type"]
};

const socialChoiceSchema = {
    type: Type.OBJECT,
    properties: {
        label: { type: Type.STRING, description: "A short label for the choice button (e.g., 'Help the merchant', 'Ignore him'). Max 5 words." },
        outcome: { type: Type.STRING, description: "The resulting story text if this choice is made. Max 60 words." },
        reward: { ...rewardSchema, description: "An optional reward for this choice. Not every choice should have a reward." }
    },
    required: ["label", "outcome"]
};

const socialEncounterSchema = {
    type: Type.OBJECT,
    properties: {
        description: { type: Type.STRING, description: "A description of a non-combat social situation with an NPC. e.g., meeting a lost child, a grumpy guard, a mysterious vendor. Max 80 words." },
        choices: {
            type: Type.ARRAY,
            description: "An array of exactly 2 choices for the player.",
            items: socialChoiceSchema
        }
    },
    required: ["description", "choices"]
};


export const generateScene = async (player: Player): Promise<{ description: string; actions: GameAction[]; foundItem?: Omit<Item, 'quantity'>; }> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a new scene for a JRPG player at level ${player.level}. The player just finished a battle or arrived in a new area. Occasionally, include a social encounter.`,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: sceneSchema,
                temperature: 1.0,
            },
        });

        const data = JSON.parse(response.text);
        // Ensure actions are unique and correct types
        const actionsMap = new Map<string, GameAction>();
        (data.actions as GameAction[]).forEach(action => {
            if (['explore', 'rest', 'encounter', 'social'].includes(action.type)) {
                if(!actionsMap.has(action.type)) {
                    actionsMap.set(action.type, action);
                }
            }
        });
        
        return {
            description: data.description,
            actions: Array.from(actionsMap.values()),
            foundItem: data.foundItem
        };
    } catch (error) {
        console.error("Error generating scene:", error);
        // Fallback in case of API error
        return {
            description: "An ancient path winds before you, shrouded in an eerie silence. The air is thick with unspoken magic.",
            actions: [
                { label: "Follow the path", type: "explore" },
                { label: "Search for danger", type: "encounter" },
                { label: "Set up camp", type: "rest" },
            ],
        };
    }
};

export const generateEncounter = async (player: Player): Promise<Enemy[]> => {
     try {
        const numMonsters = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a fantasy JRPG monster encounter for a player who is level ${player.level}. Generate exactly ${numMonsters} monster(s). Some might have special abilities like healing, shielding, multi-attack, or drain life. The encounter should be a suitable challenge.`,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: encounterSchema,
                temperature: 1.0,
            },
        });

        const data = JSON.parse(response.text) as Omit<Enemy, 'maxHp' | 'isShielded'>[];
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Invalid response format from API");
        }
        return data.map(enemy => ({ ...enemy, maxHp: enemy.hp, isShielded: false }));
    } catch (error) {
        console.error("Error generating encounter:", error);
        // Fallback enemy
        const hp = player.level * 20;
        const attack = player.level * 4;
        return [{
            name: "Slime",
            description: "A basic, gelatinous creature. It jiggles menacingly.",
            hp: hp,
            maxHp: hp,
            attack: attack,
            isShielded: false,
        }];
    }
};

export const generateSocialEncounter = async (player: Player): Promise<SocialEncounter> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a social, non-combat encounter for a level ${player.level} ${player.class} in a JRPG. The situation should present a clear choice with two distinct outcomes. One choice might offer a small reward like XP or an item.`,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: socialEncounterSchema,
                temperature: 1.0,
            },
        });
        return JSON.parse(response.text) as SocialEncounter;
    } catch (error) {
        console.error("Error generating social encounter:", error);
        // Fallback social encounter
        return {
            description: "You come across an old merchant whose cart has a broken wheel. He looks at you with weary eyes.",
            choices: [
                {
                    label: "Help him fix the wheel.",
                    outcome: "You spend some time helping the merchant. Grateful, he thanks you for your kindness.",
                    reward: { type: RewardType.XP, value: 30 }
                },
                {
                    label: "Ignore him and continue.",
                    outcome: "You decide you don't have time to help and continue on your journey down the path."
                }
            ]
        };
    }
};

export const generateCharacterPortrait = async (description: string, characterClass: CharacterClass): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    {
                        text: `A 16-bit pixel art portrait of a JRPG character. Class: ${characterClass}. Description: ${description}. Vibrant colors, fantasy style, head and shoulders view.`,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
                temperature: 0.9,
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return part.inlineData.data;
            }
        }
        throw new Error("No image data found in response.");

    } catch (error) {
        console.error("Error generating character portrait:", error);
        // In case of an error, we'll return an empty string. The UI can handle this.
        return "";
    }
};