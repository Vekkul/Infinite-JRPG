
import { Player, CharacterClass, PlayerAbility, Element, StatusEffectType } from './types';

export const JRPG_SAVE_KEY = 'jrpgSaveDataV2';

export const INITIAL_PLAYER_STATS: Player = {
  name: 'Hero',
  class: CharacterClass.WARRIOR,
  portrait: '',
  hp: 50,
  maxHp: 50,
  attack: 10,
  defense: 1, // Standardized baseline
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  isDefending: false,
  inventory: [],
  equipment: {},
  statusEffects: [],
  journal: {
      quests: [],
      flags: [],
      notes: []
  }
};

export const CLASS_STATS: Record<CharacterClass, Partial<Player>> = {
    [CharacterClass.WARRIOR]: {
        maxHp: 70,
        hp: 70,
        attack: 10, // Slightly reduced to account for high sustain/defense
        defense: 2, // Tankiest
        maxSp: 20, // Stamina
        sp: 20,
    },
    [CharacterClass.MAGE]: {
        maxHp: 45,
        hp: 45,
        attack: 6, // Low physical attack, relies on spells
        maxMp: 30,
        mp: 30,
        defense: 1, // Buffed from 0
    },
    [CharacterClass.ROGUE]: {
        maxHp: 55,
        hp: 55,
        attack: 9, 
        maxEp: 20,
        ep: 20,
        defense: 1, // Buffed to match Mage baseline, relies on Dodge/Burst
    }
};

export interface AbilityDetails {
    name: PlayerAbility;
    cost: number;
    resource: 'MP' | 'EP' | 'SP' | 'None';
    description: string;
    element: Element;
    damageMultiplier: number;
    statusEffect?: StatusEffectType;
    statusChance?: number;
}

export const PLAYER_ABILITIES: Record<PlayerAbility, AbilityDetails> = {
    [PlayerAbility.EARTHEN_STRIKE]: {
        name: PlayerAbility.EARTHEN_STRIKE,
        cost: 8, // Now has a cost
        resource: 'SP',
        description: 'A heavy blow using Stamina. Grants a temporary defense boost and has a 20% chance to make the enemy Grounded.',
        element: Element.EARTH,
        damageMultiplier: 1.3,
        statusEffect: StatusEffectType.GROUNDED,
        statusChance: 0.2,
    },
    [PlayerAbility.FIREBALL]: {
        name: PlayerAbility.FIREBALL,
        cost: 10,
        resource: 'MP',
        description: 'Hurls a ball of fire, dealing medium magical damage. Has a 10% chance to Burn the target.',
        element: Element.FIRE,
        damageMultiplier: 1.5,
        statusEffect: StatusEffectType.BURN,
        statusChance: 0.1,
    },
    [PlayerAbility.ICE_SHARD]: {
        name: PlayerAbility.ICE_SHARD,
        cost: 8,
        resource: 'MP',
        description: 'Launches a shard of ice, dealing small magical damage. Has a 20% chance to Chill the target.',
        element: Element.ICE,
        damageMultiplier: 1.2,
        statusEffect: StatusEffectType.CHILL,
        statusChance: 0.2,
    },
    [PlayerAbility.LIGHTNING_STRIKE]: {
        name: PlayerAbility.LIGHTNING_STRIKE,
        cost: 5,
        resource: 'EP',
        description: 'A rapid strike using Energy. Deals bonus damage and has a 20% chance to Shock the target.',
        element: Element.LIGHTNING,
        damageMultiplier: 1.1,
        statusEffect: StatusEffectType.SHOCK,
        statusChance: 0.2,
    }
};

// Game Mechanics
export const CRIT_CHANCE = 0.1;
export const CRIT_MULTIPLIER = 1.5;
export const FLEE_CHANCE = 0.4;
export const TRAVEL_ENCOUNTER_CHANCE = 0.35;

export const ELEMENTAL_RESISTANCES: Record<Element, Element> = {
    [Element.EARTH]: Element.LIGHTNING,
    [Element.LIGHTNING]: Element.ICE,
    [Element.ICE]: Element.FIRE,
    [Element.FIRE]: Element.EARTH,
    [Element.NONE]: Element.NONE, // For clarity
};

export const STATUS_EFFECT_CONFIG = {
    [StatusEffectType.BURN]: { duration: 3, name: 'Burn' },
    [StatusEffectType.CHILL]: { duration: 3, damageReduction: 0.2, name: 'Chill' },
    [StatusEffectType.SHOCK]: { duration: 3, stunChance: 0.1, name: 'Shock' },
    [StatusEffectType.GROUNDED]: { duration: 3, defenseReduction: 0.2, name: 'Grounded' }, // Takes 20% more damage
    [StatusEffectType.EARTH_ARMOR]: { duration: 2, defenseBonus: 0.3, name: 'Earth Armor' }, // Takes 30% less damage
};

export const ENEMY_STATUS_CHANCE: Record<Element, number> = {
    [Element.FIRE]: 0.1,
    [Element.ICE]: 0.2,
    [Element.LIGHTNING]: 0.2,
    [Element.EARTH]: 0.2,
    [Element.NONE]: 0,
};

export const ENEMY_STATUS_MAP: Record<Element, StatusEffectType> = {
    [Element.FIRE]: StatusEffectType.BURN,
    [Element.ICE]: StatusEffectType.CHILL,
    [Element.LIGHTNING]: StatusEffectType.SHOCK,
    [Element.EARTH]: StatusEffectType.GROUNDED,
    [Element.NONE]: StatusEffectType.BURN, // Should not happen
};
