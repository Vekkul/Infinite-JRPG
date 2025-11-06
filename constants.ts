import { Player, CharacterClass } from './types';

export const INITIAL_PLAYER_STATS: Player = {
  name: 'Hero',
  class: CharacterClass.WARRIOR,
  portrait: '',
  hp: 50,
  maxHp: 50,
  attack: 10,
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  isDefending: false,
  inventory: [],
};

export const CLASS_STATS: Record<CharacterClass, Partial<Player>> = {
    [CharacterClass.WARRIOR]: {
        maxHp: 70,
        hp: 70,
        attack: 12,
    },
    [CharacterClass.MAGE]: {
        maxHp: 45,
        hp: 45,
        attack: 8,
        maxMp: 30,
        mp: 30,
    },
    [CharacterClass.ROGUE]: {
        maxHp: 55,
        hp: 55,
        attack: 9,
        maxEp: 20,
        ep: 20,
    }
};