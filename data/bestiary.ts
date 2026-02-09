
import { EnemyAbility, AIPersonality, Element, StatusEffectType } from '../types';

export interface BestiaryEntry {
    id: string;
    name: string;
    description: string;
    baseHp: number;
    hpPerLevel: number;
    baseAttack: number;
    atkPerLevel: number;
    ability?: EnemyAbility;
    aiPersonality: AIPersonality;
    element: Element;
    minLevel: number; // Don't spawn dragons at level 1
}

export const BESTIARY: BestiaryEntry[] = [
    // --- Low Level (1-5) ---
    {
        id: 'slime',
        name: 'Green Slime',
        description: 'A wobbling mound of acidic goo.',
        baseHp: 15, hpPerLevel: 4,
        baseAttack: 3, atkPerLevel: 0.8,
        aiPersonality: AIPersonality.WILD,
        element: Element.EARTH,
        minLevel: 1
    },
    {
        id: 'rat',
        name: 'Dire Rat',
        description: 'An unusually large rodent with yellow teeth.',
        baseHp: 12, hpPerLevel: 3,
        baseAttack: 4, atkPerLevel: 1,
        aiPersonality: AIPersonality.AGGRESSIVE,
        element: Element.NONE,
        minLevel: 1
    },
    {
        id: 'bat',
        name: 'Vampire Bat',
        description: 'It screeches as it dives for blood.',
        baseHp: 10, hpPerLevel: 3,
        baseAttack: 4, atkPerLevel: 1.2,
        ability: EnemyAbility.DRAIN_LIFE,
        aiPersonality: AIPersonality.AGGRESSIVE,
        element: Element.NONE,
        minLevel: 1
    },
    {
        id: 'bandit',
        name: 'Roadside Bandit',
        description: 'A rough-looking thug looking for coin.',
        baseHp: 25, hpPerLevel: 5,
        baseAttack: 5, atkPerLevel: 1.5,
        aiPersonality: AIPersonality.STRATEGIC,
        element: Element.NONE,
        minLevel: 2
    },
    {
        id: 'wolf',
        name: 'Timber Wolf',
        description: 'A grey wolf with a menacing growl.',
        baseHp: 22, hpPerLevel: 5,
        baseAttack: 6, atkPerLevel: 1.5,
        ability: EnemyAbility.MULTI_ATTACK,
        aiPersonality: AIPersonality.AGGRESSIVE,
        element: Element.NONE,
        minLevel: 2
    },
    
    // --- Mid Level (5-15) ---
    {
        id: 'goblin_shaman',
        name: 'Goblin Shaman',
        description: 'Mutters incantations while waving a bone staff.',
        baseHp: 35, hpPerLevel: 6,
        baseAttack: 8, atkPerLevel: 2,
        ability: EnemyAbility.HEAL,
        aiPersonality: AIPersonality.DEFENSIVE,
        element: Element.FIRE,
        minLevel: 4
    },
    {
        id: 'skeleton_warrior',
        name: 'Skeleton Warrior',
        description: 'Animated bones wearing rusted armor.',
        baseHp: 45, hpPerLevel: 8,
        baseAttack: 10, atkPerLevel: 2,
        ability: EnemyAbility.SHIELD,
        aiPersonality: AIPersonality.DEFENSIVE,
        element: Element.ICE,
        minLevel: 5
    },
    {
        id: 'orc_grunt',
        name: 'Orc Grunt',
        description: 'A green-skinned brute with a heavy axe.',
        baseHp: 60, hpPerLevel: 10,
        baseAttack: 12, atkPerLevel: 2.5,
        aiPersonality: AIPersonality.AGGRESSIVE,
        element: Element.EARTH,
        minLevel: 6
    },
    {
        id: 'wisp',
        name: 'Arcane Wisp',
        description: 'A floating ball of crackling energy.',
        baseHp: 30, hpPerLevel: 5,
        baseAttack: 15, atkPerLevel: 3,
        aiPersonality: AIPersonality.WILD,
        element: Element.LIGHTNING,
        minLevel: 7
    },
    {
        id: 'mimic',
        name: 'Mimic',
        description: 'That chest has teeth!',
        baseHp: 50, hpPerLevel: 9,
        baseAttack: 14, atkPerLevel: 3,
        ability: EnemyAbility.MULTI_ATTACK,
        aiPersonality: AIPersonality.WILD,
        element: Element.NONE,
        minLevel: 8
    },

    // --- High Level (15+) ---
    {
        id: 'troll',
        name: 'Cave Troll',
        description: 'Massive, regenerating monstrosity.',
        baseHp: 120, hpPerLevel: 15,
        baseAttack: 18, atkPerLevel: 3,
        ability: EnemyAbility.HEAL, // Represents regen
        aiPersonality: AIPersonality.AGGRESSIVE,
        element: Element.EARTH,
        minLevel: 12
    },
    {
        id: 'fire_elemental',
        name: 'Fire Elemental',
        description: 'Living flame that burns everything nearby.',
        baseHp: 90, hpPerLevel: 10,
        baseAttack: 22, atkPerLevel: 4,
        aiPersonality: AIPersonality.WILD,
        element: Element.FIRE,
        minLevel: 14
    },
    {
        id: 'ice_golem',
        name: 'Ice Golem',
        description: 'A lumbering construct of glacial ice.',
        baseHp: 150, hpPerLevel: 18,
        baseAttack: 20, atkPerLevel: 3.5,
        ability: EnemyAbility.SHIELD,
        aiPersonality: AIPersonality.DEFENSIVE,
        element: Element.ICE,
        minLevel: 15
    },
    {
        id: 'necromancer',
        name: 'Dark Necromancer',
        description: 'Wears robes of shadow and commands death.',
        baseHp: 80, hpPerLevel: 8,
        baseAttack: 25, atkPerLevel: 5,
        ability: EnemyAbility.DRAIN_LIFE,
        aiPersonality: AIPersonality.STRATEGIC,
        element: Element.NONE,
        minLevel: 16
    },
    {
        id: 'dragon_whelp',
        name: 'Dragon Whelp',
        description: 'Small, but its breath is deadly.',
        baseHp: 200, hpPerLevel: 20,
        baseAttack: 30, atkPerLevel: 6,
        ability: EnemyAbility.MULTI_ATTACK,
        aiPersonality: AIPersonality.AGGRESSIVE,
        element: Element.FIRE,
        minLevel: 20
    }
];
