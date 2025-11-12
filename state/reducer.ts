import { AppState, Action, GameState, Item, Player, CharacterClass, Enemy, RewardType, MapLocation, PlayerAbility, StatusEffect, StatusEffectType, Element } from '../types';
import { initialState } from './initialState';
import { CLASS_STATS, PLAYER_ABILITIES, ELEMENTAL_RESISTANCES, STATUS_EFFECT_CONFIG } from '../constants';

const appendToLog = (log: string[], message: string): string[] => {
    return [...log.slice(-20), message];
};

const addItemToInventory = (inventory: Item[], itemDef: Omit<Item, 'quantity'>): Item[] => {
    const newInventory = [...inventory];
    const existingItemStackIndex = newInventory.findIndex(
        i => i.name === itemDef.name && i.quantity < i.stackLimit
    );

    if (existingItemStackIndex !== -1) {
        newInventory[existingItemStackIndex] = {
            ...newInventory[existingItemStackIndex],
            quantity: newInventory[existingItemStackIndex].quantity + 1,
        };
    } else {
        newInventory.push({ ...itemDef, quantity: 1 });
    }
    return newInventory;
};

const handleLevelUp = (currentPlayer: Player): { updatedPlayer: Player; logs: string[] } => {
    const newLevel = currentPlayer.level + 1;
    const newMaxHp = currentPlayer.maxHp + 20;
    const newAttack = currentPlayer.attack + 5;
    const newXpToNextLevel = Math.floor(currentPlayer.xpToNextLevel * 1.5);

    const logs = [
        `LEVEL UP! You are now level ${newLevel}!`,
        `HP and Attack increased!`
    ];

    const updatedPlayer: Player = {
        ...currentPlayer,
        level: newLevel,
        hp: newMaxHp,
        maxHp: newMaxHp,
        attack: newAttack,
        xp: currentPlayer.xp - currentPlayer.xpToNextLevel, // Carry over remaining XP
        xpToNextLevel: newXpToNextLevel,
    };
    
    if (updatedPlayer.class === CharacterClass.MAGE) {
        const newMaxMp = (updatedPlayer.maxMp || 0) + 10;
        updatedPlayer.maxMp = newMaxMp;
        updatedPlayer.mp = newMaxMp;
        logs.push('Max MP increased!');
    } else if (updatedPlayer.class === CharacterClass.ROGUE) {
        const newMaxEp = (updatedPlayer.maxEp || 0) + 5;
        updatedPlayer.maxEp = newMaxEp;
        updatedPlayer.ep = newMaxEp;
        logs.push('Max EP increased!');
    }


    return { updatedPlayer, logs };
};

const applyStatusEffect = (target: Player | Enemy, effect: StatusEffect): { target: Player | Enemy, log: string } => {
    const newTarget = { ...target };
    const existingEffectIndex = newTarget.statusEffects.findIndex(e => e.type === effect.type);

    if (existingEffectIndex !== -1) {
        // Refresh duration of existing effect
        newTarget.statusEffects[existingEffectIndex] = { ...newTarget.statusEffects[existingEffectIndex], duration: effect.duration };
    } else {
        newTarget.statusEffects.push(effect);
    }
    
    const logMessage = `${target.name} is afflicted with ${STATUS_EFFECT_CONFIG[effect.type].name}!`;

    return { target: newTarget, log: logMessage };
};


export const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'START_NEW_GAME':
      return {
        ...initialState,
        gameState: GameState.CHARACTER_CREATION,
        log: [],
      };
    
    case 'CREATE_CHARACTER': {
        const { name, class: characterClass, portrait } = action.payload;
        const classStats = CLASS_STATS[characterClass];

        const startingPlayer: Player = {
            ...initialState.player,
            ...classStats,
            name,
            class: characterClass,
            portrait,
            statusEffects: [],
        };

        return {
            ...state,
            player: startingPlayer,
            gameState: GameState.LOADING,
            worldData: null,
            playerLocationId: null,
            log: [`The adventure of ${name} the ${characterClass} begins...`],
        };
    }
    
    case 'LOAD_GAME':
      return {
        ...state,
        player: action.payload.player,
        storyText: action.payload.storyText,
        actions: action.payload.actions,
        log: appendToLog(action.payload.log, 'Game Loaded.'),
        worldData: action.payload.worldData,
        playerLocationId: action.payload.playerLocationId,
        enemies: [],
        gameState: GameState.EXPLORING,
      };

    case 'SET_GAME_STATE':
      return { ...state, gameState: action.payload };

    case 'ADD_LOG':
      return { ...state, log: appendToLog(state.log, action.payload) };

    case 'SET_SCENE':
      return { ...state, storyText: action.payload.description, actions: action.payload.actions };
    
    case 'SET_ENEMIES':
        return { ...state, enemies: action.payload };

    case 'SET_WORLD_DATA': {
        const worldData = action.payload;
        const startingLocationIndex = worldData.locations.findIndex(l => l.id === worldData.startLocationId);
        if (startingLocationIndex !== -1) {
            worldData.locations[startingLocationIndex].isExplored = true;
        }
        return {
            ...state,
            worldData: worldData,
            playerLocationId: worldData.startLocationId,
        };
    }

    case 'MOVE_PLAYER': {
        if (!state.worldData) return state;
        const newWorldData = JSON.parse(JSON.stringify(state.worldData));
        const newLocationIndex = newWorldData.locations.findIndex((l: MapLocation) => l.id === action.payload);
        if (newLocationIndex !== -1) {
            newWorldData.locations[newLocationIndex].isExplored = true;
        }
        return {
            ...state,
            worldData: newWorldData,
            playerLocationId: action.payload,
        };
    }

    case 'UPDATE_PLAYER':
        return { ...state, player: { ...state.player, ...action.payload } };

    case 'UPDATE_ENEMY':
        const newEnemies = [...state.enemies];
        newEnemies[action.payload.index] = { ...newEnemies[action.payload.index], ...action.payload.data };
        return { ...state, enemies: newEnemies };

    case 'SET_PLAYER_TURN':
        return { ...state, isPlayerTurn: action.payload };
    
    case 'PLAYER_ACTION_DEFEND':
        return {
            ...state,
            player: { ...state.player, isDefending: true },
            log: appendToLog(state.log, 'You brace for the next attack!'),
        };
    
    case 'PLAYER_ACTION_FLEE_FAILURE':
        return { ...state, log: appendToLog(state.log, 'You failed to escape!') };
        
    case 'PLAYER_ACTION_ABILITY': {
        const { ability, targetIndex } = action.payload;
        const abilityDetails = PLAYER_ABILITIES[ability];
        if (!abilityDetails) return state;

        let newLog = [...state.log];
        const newEnemies = [...state.enemies];
        const target = newEnemies[targetIndex];
        let newPlayerState = {...state.player};
        
        // Use resources
        if (abilityDetails.resource === 'MP') {
            newPlayerState.mp = (newPlayerState.mp || 0) - abilityDetails.cost;
        } else if (abilityDetails.resource === 'EP') {
            newPlayerState.ep = (newPlayerState.ep || 0) - abilityDetails.cost;
        }
        
        let damage = Math.floor(state.player.attack * abilityDetails.damageMultiplier + (Math.random() * 5));

        // Check for elemental resistance
        if (target.element && ELEMENTAL_RESISTANCES[target.element] === abilityDetails.element) {
            damage = Math.floor(damage / 2);
            newLog = appendToLog(newLog, `${target.name} resists the ${abilityDetails.element} attack!`);
        }

        // Check for target status effects (Grounded)
        if (target.statusEffects.some(e => e.type === StatusEffectType.GROUNDED)) {
            damage = Math.floor(damage * (1 + STATUS_EFFECT_CONFIG.GROUNDED.defenseReduction));
        }
        
        const damageTaken = target.isShielded ? Math.floor(damage / 2) : damage;
        const newHp = Math.max(0, target.hp - damageTaken);
        newEnemies[targetIndex] = { ...target, hp: newHp };
        newLog = appendToLog(newLog, `You use ${abilityDetails.name} on ${target.name} for ${damageTaken} damage!`);
        
        if (newHp <= 0) {
             newLog = appendToLog(newLog, `${target.name} is defeated!`);
        } else if (abilityDetails.statusEffect && Math.random() < (abilityDetails.statusChance || 0)) {
            // Apply status effect
            const effect: StatusEffect = {
                type: abilityDetails.statusEffect,
                duration: STATUS_EFFECT_CONFIG[abilityDetails.statusEffect].duration,
            };
            if (effect.type === StatusEffectType.BURN) {
                effect.sourceAttack = state.player.attack;
            }
            const { target: updatedTarget, log: effectLog } = applyStatusEffect(newEnemies[targetIndex], effect);
            newEnemies[targetIndex] = updatedTarget as Enemy;
            newLog = appendToLog(newLog, effectLog);
        }
        
        // Apply Earthen Strike's defense boost to player
        if (ability === PlayerAbility.EARTHEN_STRIKE) {
            const { target: updatedPlayer, log: effectLog } = applyStatusEffect(newPlayerState, {
                type: StatusEffectType.EARTH_ARMOR,
                duration: STATUS_EFFECT_CONFIG.EARTH_ARMOR.duration,
            });
            newPlayerState = updatedPlayer as Player;
            newLog = appendToLog(newLog, effectLog);
        }

        return { ...state, player: newPlayerState, enemies: newEnemies, log: newLog };
    }

    case 'ADD_ITEM_TO_INVENTORY':
        return {
            ...state,
            player: { ...state.player, inventory: addItemToInventory(state.player.inventory, action.payload) }
        };

    case 'PROCESS_COMBAT_VICTORY': {
        const { xpGained, loot, regen } = action.payload;
        
        let newLog = [...state.log];
        newLog = appendToLog(newLog, 'VICTORY! All enemies defeated!');
        if(xpGained > 0) newLog = appendToLog(newLog, `You gained ${xpGained} XP!`);
        
        let newInventory = [...state.player.inventory];
        loot.forEach(item => {
            newLog = appendToLog(newLog, `You obtained a ${item.name}!`);
            newInventory = addItemToInventory(newInventory, item);
        });
        
        let updatedPlayer: Player = {
            ...state.player,
            xp: state.player.xp + xpGained,
            inventory: newInventory,
            hp: Math.min(state.player.maxHp, state.player.hp + regen.hp),
            mp: Math.min(state.player.maxMp || 0, (state.player.mp || 0) + regen.mp),
            ep: Math.min(state.player.maxEp || 0, (state.player.ep || 0) + regen.ep),
            statusEffects: [], // Clear status effects after combat
        };

        if (regen.hp > 0) newLog = appendToLog(newLog, `Your warrior's resolve recovers you ${regen.hp} HP.`);
        if (regen.mp > 0) newLog = appendToLog(newLog, `You recovered ${regen.mp} MP.`);
        if (regen.ep > 0) newLog = appendToLog(newLog, `You recovered ${regen.ep} EP.`);
        
        if (updatedPlayer.xp >= updatedPlayer.xpToNextLevel) {
            const { updatedPlayer: leveledUpPlayer, logs: levelUpLogs } = handleLevelUp(updatedPlayer);
            updatedPlayer = leveledUpPlayer;
            levelUpLogs.forEach(l => newLog = appendToLog(newLog, l));
        }

        return {
            ...state,
            player: updatedPlayer,
            log: newLog,
        };
    }

    case 'USE_ITEM': {
        const newInventory = [...state.player.inventory];
        const itemStack = { ...newInventory[action.payload.inventoryIndex] };
        itemStack.quantity -= 1;

        if (itemStack.quantity <= 0) {
            newInventory.splice(action.payload.inventoryIndex, 1);
        } else {
            newInventory[action.payload.inventoryIndex] = itemStack;
        }
        return { ...state, player: { ...state.player, inventory: newInventory } };
    }

    case 'ENEMY_ACTION_HEAL': {
      const { enemyIndex, healAmount } = action.payload;
      const enemiesCopy = [...state.enemies];
      const enemy = enemiesCopy[enemyIndex];
      const newHp = Math.min(enemy.maxHp, enemy.hp + healAmount);
      enemiesCopy[enemyIndex] = { ...enemy, hp: newHp };
      return { ...state, enemies: enemiesCopy };
    }
    
    case 'ENEMY_ACTION_DRAIN_LIFE': {
        const { enemyIndex, damage } = action.payload;
        const enemiesCopy = [...state.enemies];
        const enemy = enemiesCopy[enemyIndex];
        const healAmount = Math.floor(damage * 0.5); // Heals for 50% of damage dealt
        
        const newEnemyHp = Math.min(enemy.maxHp, enemy.hp + healAmount);
        enemiesCopy[enemyIndex] = { ...enemy, hp: newEnemyHp };

        return { ...state, enemies: enemiesCopy };
    }

    case 'ENEMY_ACTION_SHIELD': {
      const { enemyIndex } = action.payload;
      const enemiesCopy = [...state.enemies];
      enemiesCopy[enemyIndex] = { ...enemiesCopy[enemyIndex], isShielded: true };
      return { ...state, enemies: enemiesCopy };
    }

    case 'APPLY_STATUS_EFFECT': {
        let newLog = [...state.log];
        if (action.payload.target === 'player') {
            const { target: updatedPlayer, log: effectLog } = applyStatusEffect(state.player, action.payload.effect);
            newLog = appendToLog(newLog, effectLog);
            return { ...state, player: updatedPlayer as Player, log: newLog };
        } else if (action.payload.target === 'enemy' && action.payload.index !== undefined) {
            const newEnemies = [...state.enemies];
            const { target: updatedEnemy, log: effectLog } = applyStatusEffect(newEnemies[action.payload.index], action.payload.effect);
            newEnemies[action.payload.index] = updatedEnemy as Enemy;
            newLog = appendToLog(newLog, effectLog);
            return { ...state, enemies: newEnemies, log: newLog };
        }
        return state;
    }

    case 'PROCESS_TURN_EFFECTS': {
        let newLog = [...state.log];
        let newPlayer = { ...state.player };
        let newEnemies = [...state.enemies];

        const processTarget = (target: Player | Enemy): { updatedTarget: Player | Enemy; logs: string[] } => {
            let logs: string[] = [];
            let updatedTarget = { ...target, statusEffects: [...target.statusEffects] };
            let currentHp = 'hp' in updatedTarget ? updatedTarget.hp : 0;
            
            const remainingEffects: StatusEffect[] = [];

            for (const effect of updatedTarget.statusEffects) {
                // Apply effects
                switch(effect.type) {
                    case StatusEffectType.BURN:
                        const burnDamage = Math.floor((effect.sourceAttack || 5) * 0.5);
                        currentHp = Math.max(0, currentHp - burnDamage);
                        logs.push(`${updatedTarget.name} takes ${burnDamage} damage from Burn!`);
                        break;
                }

                // Decrement duration
                const newDuration = effect.duration - 1;
                if (newDuration > 0) {
                    remainingEffects.push({ ...effect, duration: newDuration });
                } else {
                    logs.push(`${STATUS_EFFECT_CONFIG[effect.type].name} has worn off from ${updatedTarget.name}.`);
                }
            }
            
            updatedTarget.hp = currentHp;
            updatedTarget.statusEffects = remainingEffects;
            return { updatedTarget, logs };
        };
        
        if (action.payload.target === 'player') {
            const { updatedTarget, logs } = processTarget(state.player);
            newPlayer = updatedTarget as Player;
            logs.forEach(l => newLog = appendToLog(newLog, l));
        } else if (action.payload.target === 'enemy' && action.payload.index !== undefined) {
            const { updatedTarget, logs } = processTarget(state.enemies[action.payload.index]);
            newEnemies[action.payload.index] = updatedTarget as Enemy;
            logs.forEach(l => newLog = appendToLog(newLog, l));
        }

        return { ...state, player: newPlayer, enemies: newEnemies, log: newLog };
    }

    case 'SET_SOCIAL_ENCOUNTER':
        return {
            ...state,
            storyText: action.payload.description,
            socialEncounter: action.payload,
            gameState: GameState.SOCIAL_ENCOUNTER,
        };

    case 'RESOLVE_SOCIAL_CHOICE': {
        const { choice } = action.payload;
        let newLog = appendToLog(state.log, choice.outcome);
        let updatedPlayer = { ...state.player };
        let newInventory = [...state.player.inventory];

        if (choice.reward) {
            switch (choice.reward.type) {
                case RewardType.XP:
                    const xpGained = choice.reward.value || 0;
                    updatedPlayer.xp += xpGained;
                    newLog = appendToLog(newLog, `You gained ${xpGained} XP!`);
                    break;
                case RewardType.ITEM:
                    if (choice.reward.item) {
                        newInventory = addItemToInventory(newInventory, choice.reward.item);
                        newLog = appendToLog(newLog, `You obtained a ${choice.reward.item.name}!`);
                    }
                    break;
            }
        }
        
        updatedPlayer.inventory = newInventory;

        if (updatedPlayer.xp >= updatedPlayer.xpToNextLevel) {
            const { updatedPlayer: leveledUpPlayer, logs: levelUpLogs } = handleLevelUp(updatedPlayer);
            updatedPlayer = leveledUpPlayer;
            levelUpLogs.forEach(l => newLog = appendToLog(newLog, l));
        }

        return {
            ...state,
            player: updatedPlayer,
            log: newLog,
            socialEncounter: null,
        };
    }

    default:
      return state;
  }
};
