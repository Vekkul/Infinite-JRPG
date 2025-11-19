import React, { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { GameState, Player, Enemy, GameAction, Item, ItemType, SaveData, CharacterClass, EnemyAbility, SocialChoice, AIPersonality, PlayerAbility, Element, StatusEffectType, StatusEffect, WorldData } from './types';
import { generateScene, generateEncounter, generateSocialEncounter, generateWorldData, generateExploreResult, generateSceneAfterSocial } from './services/geminiService';
import { Inventory } from './components/Inventory';
import { reducer } from './state/reducer';
import { initialState } from './state/initialState';
import { StartScreen } from './components/views/StartScreen';
import { CharacterCreationScreen } from './components/views/CharacterCreationScreen';
import { LoadingScreen } from './components/views/LoadingScreen';
import { GameOverScreen } from './components/views/GameOverScreen';
import { ExploringView } from './components/views/ExploringView';
import { CombatView } from './components/views/CombatView';
import { SocialEncounterView } from './components/views/SocialEncounterView';
import { WorldMapView } from './components/views/WorldMapView';
import { LogView } from './components/views/LogView';
import { HeartIcon, StarIcon, SaveIcon, BoltIcon, FireIcon, MapIcon, BagIcon, SpeakerOnIcon, SpeakerOffIcon, BookIcon, ShieldIcon } from './components/icons';
import { JRPG_SAVE_KEY, CRIT_CHANCE, CRIT_MULTIPLIER, FLEE_CHANCE, TRAVEL_ENCOUNTER_CHANCE, STATUS_EFFECT_CONFIG, ENEMY_STATUS_CHANCE, ENEMY_STATUS_MAP } from './constants';
import { useAudio } from './hooks/useAudio';

interface EventPopup {
  id: number;
  text: string;
  type: 'info' | 'heal' | 'item' | 'xp';
}

const statusEffectIcons: Record<StatusEffectType, React.ReactNode> = {
    [StatusEffectType.BURN]: <FireIcon className="w-4 h-4 text-orange-400" />,
    [StatusEffectType.CHILL]: <span className="text-cyan-400 text-xs">❄️</span>,
    [StatusEffectType.SHOCK]: <BoltIcon className="w-4 h-4 text-yellow-400" />,
    [StatusEffectType.GROUNDED]: <span className="text-amber-700 text-xs">⛰️</span>,
    [StatusEffectType.EARTH_ARMOR]: <ShieldIcon className="w-4 h-4 text-green-500" />,
};

// Helper function to build and sanitize scene actions
const getSceneActions = (localActions: GameAction[], worldData: WorldData, playerLocationId: string): GameAction[] => {
    // Filter out any potential 'move' actions returned by the LLM from local actions
    const filteredLocalActions = localActions.filter(a => a.type !== 'move');

    // De-duplicate move actions based on target location ID
    const moveTargetIds = new Set<string>();
    worldData.connections
        .filter(c => c.from === playerLocationId || c.to === playerLocationId)
        .forEach(c => {
            const targetId = c.from === playerLocationId ? c.to : c.from;
            moveTargetIds.add(targetId);
        });

    const moveActions = Array.from(moveTargetIds).map(targetId => {
        const targetLocation = worldData.locations.find(l => l.id === targetId);
        return {
            label: `Go to ${targetLocation?.name || '???' }`,
            type: 'move' as const,
            targetLocationId: targetId
        };
    });

    return [...filteredLocalActions, ...moveActions];
}

const App: React.FC = () => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const { gameState, player, enemies, storyText, actions, log, isPlayerTurn, socialEncounter, worldData, playerLocationId } = state;

    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [saveFileExists, setSaveFileExists] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [eventPopups, setEventPopups] = useState<EventPopup[]>([]);

    const enemyTurnInProgress = useRef(false);
    const prevLevelRef = useRef(player.level);
    const isInitialMount = useRef(true);
    const prevPlayerLocationId = useRef<string | null>(null);

    // Custom hook handles all audio/TTS logic
    const { isTtsEnabled, isSpeaking, toggleTts } = useAudio(storyText, gameState);

    useEffect(() => {
        const savedData = localStorage.getItem(JRPG_SAVE_KEY);
        setSaveFileExists(!!savedData);
    }, []);

    useEffect(() => {
        if (player.level > prevLevelRef.current) {
            setShowLevelUp(true);
            const timer = setTimeout(() => setShowLevelUp(false), 3000); // Duration of the animation
            return () => clearTimeout(timer);
        }
        prevLevelRef.current = player.level;
    }, [player.level]);

    const createEventPopup = useCallback((text: string, type: EventPopup['type']) => {
        const newPopup: EventPopup = { id: Date.now() + Math.random(), text, type };
        setEventPopups(prev => [...prev, newPopup]);
        setTimeout(() => {
            setEventPopups(prev => prev.filter(p => p.id !== newPopup.id));
        }, 2500);
    }, []);
    
    const appendToLog = useCallback((message: string) => {
        dispatch({ type: 'ADD_LOG', payload: message });
    }, []);

    const handleFallback = useCallback(() => {
        appendToLog('A strange energy interferes with your perception...');
    }, [appendToLog]);
    
    const handleFoundItem = useCallback((itemDef: Omit<Item, 'quantity'>) => {
        appendToLog(`You found a ${itemDef.name}!`);
        createEventPopup(`Found: ${itemDef.name}!`, 'item');
        dispatch({ type: 'ADD_ITEM_TO_INVENTORY', payload: itemDef });
    }, [appendToLog, createEventPopup]);

    const startNewGame = useCallback(() => {
        dispatch({ type: 'START_NEW_GAME' });
    }, []);

    const handleCharacterCreation = useCallback(async (details: { name: string; class: CharacterClass; portrait: string }) => {
        dispatch({ type: 'CREATE_CHARACTER', payload: details });
        
        const newWorldData = await generateWorldData();
        if (!newWorldData) {
            dispatch({ type: 'SET_GAME_STATE', payload: GameState.START_SCREEN });
            appendToLog("Error: Could not generate a new world. Please try again.");
            return;
        }
        dispatch({ type: 'SET_WORLD_DATA', payload: newWorldData });

        const startLocation = newWorldData.locations.find(l => l.id === newWorldData.startLocationId);
        if (startLocation) {
            const tempPlayer = { ...initialState.player, name: details.name, class: details.class, portrait: details.portrait };
            const { description, actions: localActions, foundItem, isFallback } = await generateScene(tempPlayer, startLocation);
            
            if (isFallback) handleFallback();

            const allActions = getSceneActions(localActions, newWorldData, newWorldData.startLocationId);

            dispatch({ type: 'SET_SCENE', payload: { description: description, actions: allActions } });
            if (foundItem) {
                handleFoundItem(foundItem);
            }
        }
        dispatch({ type: 'SET_GAME_STATE', payload: GameState.EXPLORING });

    }, [handleFoundItem, appendToLog, handleFallback]);

    const saveGame = useCallback(() => {
        if (!worldData || !playerLocationId) return;
        const saveData: SaveData = { player, storyText, actions, log, worldData, playerLocationId };
        localStorage.setItem(JRPG_SAVE_KEY, JSON.stringify(saveData));
        setSaveFileExists(true);
        appendToLog('Game Saved!');
    }, [player, storyText, actions, log, worldData, playerLocationId, appendToLog]);

    const loadGame = useCallback(() => {
        const savedDataString = localStorage.getItem(JRPG_SAVE_KEY);
        if (savedDataString) {
            const savedData: SaveData = JSON.parse(savedDataString);
            dispatch({ type: 'LOAD_GAME', payload: savedData });
        } else {
            appendToLog('No save file found.');
        }
    }, [appendToLog]);

    const handleAction = useCallback(async (action: GameAction) => {
        if (action.type === 'move' && action.targetLocationId) {
            dispatch({ type: 'MOVE_PLAYER', payload: action.targetLocationId });
            return;
        }
    
        dispatch({ type: 'SET_GAME_STATE', payload: GameState.LOADING });
        appendToLog(`You decide to ${action.label.toLowerCase()}...`);
    
        if (action.type === 'encounter') {
            const { enemies: newEnemies, isFallback } = await generateEncounter(player);
            if (isFallback) handleFallback();
            const enemyNames = newEnemies.map(e => e.name).join(', ');
            dispatch({ type: 'SET_ENEMIES', payload: newEnemies });
            dispatch({ type: 'SET_SCENE', payload: { description: `A wild ${enemyNames} appeared!`, actions: [] } });
            appendToLog(newEnemies.length > 0 ? newEnemies[0].description : 'A mysterious force blocks your way.');
            dispatch({ type: 'SET_GAME_STATE', payload: GameState.COMBAT });
            dispatch({ type: 'SET_PLAYER_TURN', payload: true });
        } else if (action.type === 'explore') {
            const result = await generateExploreResult(player, action);
            if (result.isFallback) handleFallback();
            appendToLog(result.outcome);
    
            if (result.foundItem) {
                handleFoundItem(result.foundItem);
            }
    
            if (result.triggerCombat) {
                const { enemies: newEnemies, isFallback } = await generateEncounter(player);
                if (isFallback) handleFallback();
                const enemyNames = newEnemies.map(e => e.name).join(', ');
                dispatch({ type: 'SET_ENEMIES', payload: newEnemies });
                dispatch({ type: 'SET_SCENE', payload: { description: `${result.outcome} Suddenly, a ${enemyNames} attacks!`, actions: [] } });
                appendToLog(newEnemies.length > 0 ? newEnemies[0].description : 'An unseen foe strikes!');
                dispatch({ type: 'SET_GAME_STATE', payload: GameState.COMBAT });
                dispatch({ type: 'SET_PLAYER_TURN', payload: true });
            } else if (result.triggerSocial) {
                const { encounter: socialEncounter, isFallback } = await generateSocialEncounter(player);
                if (isFallback) handleFallback();
                socialEncounter.description = `${result.outcome} ${socialEncounter.description}`;
                dispatch({ type: 'SET_SOCIAL_ENCOUNTER', payload: socialEncounter });
            } else {
                if (worldData && playerLocationId) {
                    const currentLocation = worldData.locations.find(l => l.id === playerLocationId);
                    if (currentLocation) {
                        const { actions: localActions, foundItem, isFallback } = await generateScene(player, currentLocation);
                        if(isFallback) handleFallback();
                        
                        const newActions = getSceneActions(localActions, worldData, playerLocationId);
        
                        dispatch({ type: 'SET_SCENE', payload: { description: result.outcome, actions: newActions } });
        
                        if (foundItem) {
                            handleFoundItem(foundItem);
                        }
                    }
                }
                dispatch({ type: 'SET_GAME_STATE', payload: GameState.EXPLORING });
            }
        }
    }, [player, appendToLog, handleFoundItem, worldData, playerLocationId, handleFallback]);

    useEffect(() => {
        const prevLocationId = prevPlayerLocationId.current;
        prevPlayerLocationId.current = playerLocationId;

        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        
        if (prevLocationId && prevLocationId !== playerLocationId) {
            if (playerLocationId && worldData) {
                const move = async () => {
                    dispatch({ type: 'SET_GAME_STATE', payload: GameState.LOADING });

                    const newLocation = worldData.locations.find(l => l.id === playerLocationId);
                    if (!newLocation) return;
                    
                    appendToLog(`You travel to ${newLocation.name}...`);
                    
                    if (Math.random() < TRAVEL_ENCOUNTER_CHANCE) {
                        const { enemies: newEnemies, isFallback } = await generateEncounter(player);
                        if (isFallback) handleFallback();
                        const enemyNames = newEnemies.map(e => e.name).join(', ');
                        dispatch({ type: 'SET_ENEMIES', payload: newEnemies });
                        dispatch({ type: 'SET_SCENE', payload: { description: `While traveling to ${newLocation.name}, you are ambushed by a ${enemyNames}!`, actions: [] } });
                        appendToLog(newEnemies.length > 0 ? newEnemies[0].description : 'A mysterious force blocks your way.');
                        dispatch({ type: 'SET_GAME_STATE', payload: GameState.COMBAT });
                        dispatch({ type: 'SET_PLAYER_TURN', payload: true });
                    } else {
                        const { description, actions: localActions, foundItem, isFallback } = await generateScene(player, newLocation);
                        if (isFallback) handleFallback();
                         
                        const newActions = getSceneActions(localActions, worldData, playerLocationId);
                        dispatch({ type: 'SET_SCENE', payload: { description, actions: newActions } });

                        if (foundItem) handleFoundItem(foundItem);
                        dispatch({ type: 'SET_GAME_STATE', payload: GameState.EXPLORING });
                    }
                };
                move();
            }
        }
    }, [playerLocationId, worldData, player, appendToLog, handleFoundItem, handleFallback]);

    const handleUseItem = useCallback((item: Item, index: number) => {
        if (item.type === ItemType.POTION) {
            const healAmount = item.value || 0;
            const newHp = Math.min(player.maxHp, player.hp + healAmount);
            const healed = newHp - player.hp;

            if (healed > 0) {
                dispatch({type: 'USE_ITEM', payload: { inventoryIndex: index }});
                dispatch({ type: 'UPDATE_PLAYER', payload: { hp: newHp } });

                const logMessage = `You use a ${item.name} and recover ${healed} HP.`;
                appendToLog(logMessage);
                createEventPopup(`+${healed} HP`, 'heal');
                setIsInventoryOpen(false);

                if (gameState === GameState.COMBAT) {
                    dispatch({ type: 'SET_PLAYER_TURN', payload: false });
                }
            } else {
                appendToLog(`Your HP is already full!`);
            }
        }
    }, [player, appendToLog, gameState, createEventPopup]);

    const loadSceneForCurrentLocation = useCallback(async () => {
        if (!worldData || !playerLocationId) return;

        dispatch({ type: 'SET_GAME_STATE', payload: GameState.LOADING });

        const currentLocation = worldData.locations.find(l => l.id === playerLocationId);
        if (!currentLocation) return;
        
        const { description, actions: localActions, foundItem, isFallback } = await generateScene(player, currentLocation);
        if (isFallback) handleFallback();

        const newActions = getSceneActions(localActions, worldData, playerLocationId);

        dispatch({ type: 'SET_SCENE', payload: { description, actions: newActions } });
        if (foundItem) handleFoundItem(foundItem);
        dispatch({ type: 'SET_GAME_STATE', payload: GameState.EXPLORING });

    }, [worldData, playerLocationId, player, handleFoundItem, handleFallback]);

    const handleCombatAction = useCallback(async (
        action: 'attack' | 'defend' | 'flee' | 'ability',
        payload?: { ability?: PlayerAbility; targetIndex?: number; onDamageDealt?: (damage: number, isCrit: boolean) => void; }
    ) => {
        if (!isPlayerTurn || enemies.length === 0) return;

        dispatch({ type: 'SET_PLAYER_TURN', payload: false });
        dispatch({ type: 'UPDATE_PLAYER', payload: { isDefending: false } });
        
        dispatch({ type: 'PROCESS_TURN_EFFECTS', payload: { target: 'player' } });

        if (action === 'attack' && payload?.targetIndex !== undefined) {
            const target = enemies[payload.targetIndex];
            const isCrit = Math.random() < CRIT_CHANCE;
            let damage = Math.floor(player.attack + (Math.random() * 5 - 2));
            if (isCrit) {
                damage = Math.floor(damage * CRIT_MULTIPLIER);
            }

            // Apply GROUNDED damage modifier
            if (target.statusEffects.some(e => e.type === StatusEffectType.GROUNDED)) {
                damage = Math.floor(damage * (1 + STATUS_EFFECT_CONFIG.GROUNDED.defenseReduction));
            }

            const damageTaken = target.isShielded ? Math.floor(damage / 2) : damage;
            const newHp = Math.max(0, target.hp - damageTaken);

            payload.onDamageDealt?.(damageTaken, isCrit);

            dispatch({ type: 'UPDATE_ENEMY', payload: { index: payload.targetIndex, data: { hp: newHp } } });
            appendToLog(`You attack ${target.name} for ${damageTaken} damage! ${isCrit ? 'CRITICAL HIT!' : ''}`);
            if (newHp <= 0) {
                appendToLog(`${target.name} is defeated!`);
            }
        } else if (action === 'ability' && payload?.targetIndex !== undefined && payload.ability) {
            dispatch({ type: 'PLAYER_ACTION_ABILITY', payload: { ability: payload.ability, targetIndex: payload.targetIndex } });
        } else if (action === 'defend') {
            dispatch({ type: 'PLAYER_ACTION_DEFEND' });
        } else if (action === 'flee') {
            if (Math.random() < FLEE_CHANCE) {
                appendToLog('You successfully escaped!');
                await loadSceneForCurrentLocation();
                dispatch({ type: 'SET_ENEMIES', payload: [] });
                return;
            } else {
                dispatch({ type: 'PLAYER_ACTION_FLEE_FAILURE' });
            }
        }
    }, [player, enemies, appendToLog, isPlayerTurn, loadSceneForCurrentLocation]);

    const handleSocialChoice = useCallback(async (choice: SocialChoice) => {
        dispatch({ type: 'SET_GAME_STATE', payload: GameState.LOADING });
    
        dispatch({ type: 'RESOLVE_SOCIAL_CHOICE', payload: { choice } });

        if (choice.reward) {
            if (choice.reward.type === 'XP' && choice.reward.value) {
                createEventPopup(`+${choice.reward.value} XP`, 'xp');
            } else if (choice.reward.type === 'ITEM' && choice.reward.item) {
                createEventPopup(`Found: ${choice.reward.item.name}!`, 'item');
            }
        }
    
        if (worldData && playerLocationId) {
            const currentLocation = worldData.locations.find(l => l.id === playerLocationId);
            if (currentLocation) {
                // Generate a new scene that is contextually aware of the choice's outcome
                const { description, actions: localActions, foundItem, isFallback } = await generateSceneAfterSocial(player, currentLocation, choice.outcome);
                if (isFallback) handleFallback();
                
                const newActions = getSceneActions(localActions, worldData, playerLocationId);
                
                dispatch({ type: 'SET_SCENE', payload: { description, actions: newActions } });
    
                if (foundItem) {
                    handleFoundItem(foundItem);
                }
            }
        }
        
        dispatch({ type: 'SET_GAME_STATE', payload: GameState.EXPLORING });
    }, [worldData, playerLocationId, player, handleFoundItem, handleFallback, createEventPopup]);

    const handleEnemyTurns = useCallback(async () => {
        enemyTurnInProgress.current = true;
        let currentHp = player.hp;

        const determineEnemyAction = (enemy: Enemy): 'attack' | EnemyAbility => {
            if (!enemy.ability) return 'attack';
            
            const hpPercent = enemy.hp / enemy.maxHp;
            const isPlayerDefending = player.isDefending;
            const isPlayerLow = (currentHp / player.maxHp) < 0.3;

            const canHeal = enemy.ability === EnemyAbility.HEAL;
            const canShield = enemy.ability === EnemyAbility.SHIELD && !enemy.isShielded;
            const canDrain = enemy.ability === EnemyAbility.DRAIN_LIFE;
            const canMulti = enemy.ability === EnemyAbility.MULTI_ATTACK;

            switch (enemy.aiPersonality) {
                case AIPersonality.AGGRESSIVE:
                    // Aggressive: Push for the kill, especially if player is low.
                    if (isPlayerLow && (canMulti || canDrain)) return enemy.ability;
                    
                    // Rarely heal/shield, only if critical
                    if (hpPercent < 0.25 && canHeal && Math.random() < 0.8) return EnemyAbility.HEAL;
                    if (hpPercent < 0.25 && canShield && Math.random() < 0.8) return EnemyAbility.SHIELD;

                    // Use offensive abilities often
                    if (canMulti && Math.random() < 0.6) return EnemyAbility.MULTI_ATTACK;
                    if (canDrain && Math.random() < 0.5) return EnemyAbility.DRAIN_LIFE;
                    
                    return 'attack';

                case AIPersonality.DEFENSIVE:
                    // Defensive: prioritize health and shielding.
                    if (hpPercent < 0.6 && canHeal && Math.random() < 0.9) return EnemyAbility.HEAL;
                    if (hpPercent < 0.75 && canShield && Math.random() < 0.8) return EnemyAbility.SHIELD;
                    
                    // Only attack if safe-ish, or use drain to sustain
                    if (canDrain && hpPercent < 0.8) return EnemyAbility.DRAIN_LIFE;

                    return 'attack';

                case AIPersonality.STRATEGIC:
                    // Strategic: Respond to player state.
                    
                    // If player is defending, don't waste big attacks. Buff self or heal.
                    if (isPlayerDefending) {
                         if (canHeal && hpPercent < 0.9) return EnemyAbility.HEAL;
                         if (canShield) return EnemyAbility.SHIELD;
                    }

                    // If player is vulnerable (low hp), execute
                    if (isPlayerLow && (canMulti || canDrain)) return enemy.ability;

                    // Smart healing threshold
                    if (hpPercent < 0.4 && canHeal) return EnemyAbility.HEAL;
                    
                    // Shield if somewhat low but not critical
                    if (hpPercent < 0.6 && canShield) return EnemyAbility.SHIELD;

                    // Use drain efficiently (when not full HP)
                    if (canDrain && hpPercent < 0.85) return EnemyAbility.DRAIN_LIFE;

                    // Use multi attack for damage output
                    if (canMulti && Math.random() < 0.5) return EnemyAbility.MULTI_ATTACK;

                    return 'attack';

                case AIPersonality.WILD:
                    // Wild: High variance.
                    if (canShield && Math.random() < 0.35) return EnemyAbility.SHIELD;
                    if (canHeal && hpPercent < 0.8 && Math.random() < 0.4) return EnemyAbility.HEAL;
                    if ((canMulti || canDrain) && Math.random() < 0.5) return enemy.ability;
                    return 'attack';

                default:
                    return 'attack';
            }
        };

        for (let i = 0; i < enemies.length; i++) {
                if (enemies[i].hp > 0 && currentHp > 0) { 
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                dispatch({ type: 'PROCESS_TURN_EFFECTS', payload: { target: 'enemy', index: i } });
                const enemy = state.enemies[i]; // Get latest state after dispatch

                // SHOCK check
                if (enemy.statusEffects.some(e => e.type === StatusEffectType.SHOCK) && Math.random() < STATUS_EFFECT_CONFIG.SHOCK.stunChance) {
                    appendToLog(`${enemy.name} is Shocked and unable to move!`);
                    continue;
                }
                
                if (enemy.isShielded) {
                    dispatch({ type: 'UPDATE_ENEMY', payload: { index: i, data: { isShielded: false } } });
                    appendToLog(`${enemy.name}'s shield fades.`);
                }
                
                const actionToTake = determineEnemyAction(enemy);

                if (actionToTake !== 'attack') {
                    appendToLog(`${enemy.name} uses ${actionToTake}!`);
                    switch (actionToTake) {
                        case EnemyAbility.HEAL:
                            const healAmount = Math.floor(enemy.maxHp * 0.35); // Buffed heal slightly
                            dispatch({ type: 'ENEMY_ACTION_HEAL', payload: { enemyIndex: i, healAmount } });
                            createEventPopup(`${enemy.name} heals!`, 'heal');
                            appendToLog(`${enemy.name} recovers ${healAmount} HP.`);
                            break;
                        case EnemyAbility.SHIELD:
                            dispatch({ type: 'ENEMY_ACTION_SHIELD', payload: { enemyIndex: i } });
                            createEventPopup(`${enemy.name} shields!`, 'info');
                            appendToLog(`${enemy.name} raises a magical shield!`);
                            break;
                        case EnemyAbility.DRAIN_LIFE:
                            const drainDamage = Math.floor(enemy.attack * 0.8 + (Math.random() * 4 - 2));
                            const playerDamageTakenDrain = player.isDefending ? Math.max(1, Math.floor(drainDamage / 2)) : drainDamage;
                            currentHp = Math.max(0, currentHp - playerDamageTakenDrain);
                            dispatch({ type: 'UPDATE_PLAYER', payload: { hp: currentHp } });
                            dispatch({type: 'ENEMY_ACTION_DRAIN_LIFE', payload: { enemyIndex: i, damage: playerDamageTakenDrain }})
                            appendToLog(`${enemy.name} drains ${playerDamageTakenDrain} HP from you!`);
                            break;
                        case EnemyAbility.MULTI_ATTACK:
                            for (let j=0; j<2; j++) {
                                if(currentHp > 0) {
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                    const multiDamage = Math.floor(enemy.attack * 0.7 + (Math.random() * 3 - 1));
                                    const playerDamageTakenMulti = player.isDefending ? Math.max(1, Math.floor(multiDamage / 2)) : multiDamage;
                                    currentHp = Math.max(0, currentHp - playerDamageTakenMulti);
                                    dispatch({ type: 'UPDATE_PLAYER', payload: { hp: currentHp } });
                                    appendToLog(`${enemy.name} strikes! You take ${playerDamageTakenMulti} damage.`);
                                }
                            }
                            break;
                    }
                } else {
                    const isCrit = Math.random() < CRIT_CHANCE;
                    let enemyDamage = Math.floor(enemy.attack + (Math.random() * 4 - 2));

                    // CHILL check
                    if (enemy.statusEffects.some(e => e.type === StatusEffectType.CHILL)) {
                        enemyDamage = Math.floor(enemyDamage * (1 - STATUS_EFFECT_CONFIG.CHILL.damageReduction));
                    }

                    if(isCrit) {
                        enemyDamage = Math.floor(enemyDamage * CRIT_MULTIPLIER);
                    }
                    
                    let playerDamageTaken = player.isDefending ? Math.max(1, Math.floor(enemyDamage / 2)) : enemyDamage;
                    
                    // Player GROUNDED/EARTH_ARMOR check
                    if (player.statusEffects.some(e => e.type === StatusEffectType.GROUNDED)) {
                        playerDamageTaken = Math.floor(playerDamageTaken * (1 + STATUS_EFFECT_CONFIG.GROUNDED.defenseReduction));
                    }
                     if (player.statusEffects.some(e => e.type === StatusEffectType.EARTH_ARMOR)) {
                        playerDamageTaken = Math.floor(playerDamageTaken * (1 - STATUS_EFFECT_CONFIG.EARTH_ARMOR.defenseBonus));
                    }

                    const newPlayerHp = Math.max(0, currentHp - playerDamageTaken);
                    currentHp = newPlayerHp;
                    dispatch({ type: 'UPDATE_PLAYER', payload: { hp: newPlayerHp } });
                    appendToLog(`${enemy.name} attacks! You take ${playerDamageTaken} damage. ${isCrit ? 'CRITICAL!' : ''}`);

                    // Apply status effect from enemy attack
                    if (enemy.element && enemy.element !== Element.NONE && Math.random() < ENEMY_STATUS_CHANCE[enemy.element]) {
                        const effectType = ENEMY_STATUS_MAP[enemy.element];
                        const effect: StatusEffect = {
                            type: effectType,
                            duration: STATUS_EFFECT_CONFIG[effectType].duration
                        };
                        if(effect.type === StatusEffectType.BURN) {
                            effect.sourceAttack = enemy.attack;
                        }
                        dispatch({type: 'APPLY_STATUS_EFFECT', payload: { target: 'player', effect }})
                    }
                }

                if (currentHp <= 0) {
                    dispatch({ type: 'SET_GAME_STATE', payload: GameState.GAME_OVER });
                    appendToLog('You have been defeated...');
                    enemyTurnInProgress.current = false;
                    return;
                }
            }
        }
        if (currentHp > 0) {
            dispatch({ type: 'SET_PLAYER_TURN', payload: true });
        }
        enemyTurnInProgress.current = false;

    }, [enemies, player, appendToLog, createEventPopup, state.enemies]);

    const handleCombatVictory = useCallback(async (defeatedEnemies: Enemy[]) => {
        const totalXpGained = defeatedEnemies.reduce((sum, e) => sum + Math.floor(e.maxHp / 2) + e.attack, 0);
        const lootItems = defeatedEnemies.map(e => e.loot).filter((l): l is Omit<Item, 'quantity'> => !!l);

        createEventPopup('VICTORY!', 'info');
        if (totalXpGained > 0) setTimeout(() => createEventPopup(`+${totalXpGained} XP`, 'xp'), 500);
        lootItems.forEach((item, index) => setTimeout(() => createEventPopup(`Found: ${item.name}!`, 'item'), 1000 + index * 500));
        
        let regen = { hp: 0, mp: 0, ep: 0 };
        if (player.class === CharacterClass.MAGE) {
            regen.mp = Math.floor((player.maxMp || 0) * 0.2);
            if(regen.mp > 0) setTimeout(() => createEventPopup(`+${regen.mp} MP`, 'heal'), 1500 + lootItems.length * 500);
        } else if (player.class === CharacterClass.ROGUE) {
            regen.ep = Math.floor((player.maxEp || 0) * 0.25);
            if (regen.ep > 0) setTimeout(() => createEventPopup(`+${regen.ep} EP`, 'heal'), 1500 + lootItems.length * 500);
        } else if (player.class === CharacterClass.WARRIOR) {
            regen.hp = Math.floor(player.maxHp * 0.1);
            if (regen.hp > 0) setTimeout(() => createEventPopup(`+${regen.hp} HP`, 'heal'), 1500 + lootItems.length * 500);
        }

        dispatch({ 
            type: 'PROCESS_COMBAT_VICTORY', 
            payload: { xpGained: totalXpGained, loot: lootItems, regen }
        });

        await loadSceneForCurrentLocation();
        dispatch({ type: 'SET_ENEMIES', payload: [] });
    }, [player, loadSceneForCurrentLocation, createEventPopup]);
    
    useEffect(() => {
        if (gameState !== GameState.COMBAT || isPlayerTurn || enemyTurnInProgress.current) return;

        const allEnemiesDefeated = enemies.every(e => e.hp <= 0);
        if (allEnemiesDefeated && enemies.length > 0) {
            handleCombatVictory(enemies);
            return;
        }

        if (enemies.some(e => e.hp > 0)) {
           handleEnemyTurns();
        }

    }, [isPlayerTurn, enemies, gameState, handleEnemyTurns, handleCombatVictory]);
    
    const renderGameContent = () => {
        switch (gameState) {
            case GameState.START_SCREEN:
                return <StartScreen onStart={startNewGame} onLoad={loadGame} saveFileExists={saveFileExists} />;
            case GameState.CHARACTER_CREATION:
                return <CharacterCreationScreen onCreate={handleCharacterCreation} />;
            case GameState.LOADING:
                return <LoadingScreen />;
            case GameState.GAME_OVER:
                return <GameOverScreen onRestart={startNewGame} />;
            case GameState.EXPLORING:
                return <ExploringView storyText={storyText} actions={actions} onAction={handleAction} />;
            case GameState.COMBAT:
                return <CombatView 
                    storyText={storyText} 
                    enemies={enemies} 
                    player={player}
                    isPlayerTurn={isPlayerTurn} 
                    onCombatAction={handleCombatAction} 
                />;
            case GameState.SOCIAL_ENCOUNTER:
                return socialEncounter && <SocialEncounterView encounter={socialEncounter} onChoice={handleSocialChoice} />;
            default:
                return null;
        }
    };

    const isScreenState = gameState === GameState.START_SCREEN || gameState === GameState.LOADING || gameState === GameState.GAME_OVER || gameState === GameState.CHARACTER_CREATION;

    return (
        <main className="h-screen w-screen bg-gray-900 text-gray-200 p-2" style={{
            backgroundImage: `radial-gradient(circle, rgba(31, 41, 55, 0.9) 0%, rgba(17, 24, 39, 1) 70%)`,
        }}>
            <Inventory 
                isOpen={isInventoryOpen}
                onClose={() => setIsInventoryOpen(false)}
                inventory={player.inventory}
                onUseItem={handleUseItem}
                disabled={!isPlayerTurn && gameState === GameState.COMBAT}
            />
            <WorldMapView
                isOpen={isMapOpen}
                onClose={() => setIsMapOpen(false)}
                worldData={worldData}
                playerLocationId={playerLocationId}
            />
             <LogView
                isOpen={isLogOpen}
                onClose={() => setIsLogOpen(false)}
                log={log}
            />
            <div className="max-w-7xl mx-auto h-full bg-black/30 rounded-2xl border-4 border-gray-700 shadow-2xl p-2 flex flex-col relative">
                {showLevelUp && (
                    <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center pointer-events-none">
                        <h1 className="text-6xl md:text-8xl font-press-start text-yellow-300 animate-level-up" style={{textShadow: '4px 4px 0 #000'}}>
                            LEVEL UP!
                        </h1>
                    </div>
                )}
                 <div className="event-popup-container">
                    {eventPopups.map(p => (
                        <div key={p.id} className={`event-popup ${p.type}`}>{p.text}</div>
                    ))}
                </div>
                <div className={`flex flex-col md:grid md:grid-cols-3 gap-3 h-full p-2 md:p-3 ${isScreenState ? 'md:items-center' : ''}`}>
                    {/* Player Status */}
                    {!isScreenState && (
                        <div className="md:col-span-1 flex flex-col order-1 shrink-0">
                            <div className="bg-gray-800/80 rounded-lg border-2 border-blue-500/50 shadow-xl overflow-hidden flex items-stretch h-32 md:h-auto">
                                {player.portrait && (
                                    <div className="w-28 md:w-32 bg-black border-r-2 border-blue-900/30 relative shrink-0">
                                        <img src={`data:image/png;base64,${player.portrait}`} alt="Player Portrait" className="absolute inset-0 w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="flex flex-col flex-grow p-2 md:p-3 justify-between min-w-0">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-grow min-w-0 mr-2">
                                            <h2 className="text-base md:text-lg font-press-start text-blue-300 truncate leading-tight">{player.name}</h2>
                                            <p className="text-xs text-gray-400">{player.class}</p>
                                        </div>
                                        <div className="text-right shrink-0 flex flex-col items-end">
                                             <div className="text-xs text-gray-500 font-bold">LVL {player.level}</div>
                                             <div className="text-xs text-gray-400">ATK <span className="text-white font-bold">{player.attack}</span></div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1.5 my-1">
                                        <div className="w-full h-4 bg-gray-900 rounded-full border border-gray-700 relative overflow-hidden">
                                             <div className="bg-red-600 h-full transition-all duration-500" style={{ width: `${(player.hp / player.maxHp) * 100}%` }}></div>
                                             <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white shadow-black drop-shadow-md">HP {player.hp}/{player.maxHp}</div>
                                        </div>
                                        {(player.class === CharacterClass.MAGE || player.class === CharacterClass.ROGUE) && (
                                             <div className="w-full h-4 bg-gray-900 rounded-full border border-gray-700 relative overflow-hidden">
                                                <div className={`${player.class === CharacterClass.MAGE ? 'bg-blue-600' : 'bg-green-600'} h-full transition-all duration-500`} style={{ width: `${((player.mp || player.ep || 0) / (player.maxMp || player.maxEp || 1)) * 100}%` }}></div>
                                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white shadow-black drop-shadow-md">
                                                    {player.class === CharacterClass.MAGE ? 'MP' : 'EP'} {player.mp || player.ep}/{player.maxMp || player.maxEp}
                                                </div>
                                            </div>
                                        )}
                                         <div className="w-full h-2 bg-gray-900 rounded-full relative overflow-hidden">
                                             <div className="bg-yellow-500 h-full transition-all duration-500" style={{ width: `${(player.xp / player.xpToNextLevel) * 100}%` }}></div>
                                         </div>
                                    </div>

                                     <div className="flex justify-start items-center gap-1 h-5">
                                        {player.statusEffects.map(effect => (
                                            <div key={effect.type} className="relative group bg-black/40 p-0.5 rounded">
                                                {statusEffectIcons[effect.type]}
                                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max bg-black/80 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                    {STATUS_EFFECT_CONFIG[effect.type].name} ({effect.duration} turns)
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Screen & Log */}
                    <div className={`flex flex-col bg-black/50 rounded-lg border-2 border-gray-600 shadow-inner order-2 md:row-span-2 ${isScreenState ? 'md:col-span-3 h-full' : 'md:col-span-2'} grow min-h-0`}>
                        <div className={`p-6 text-xl leading-relaxed relative overflow-y-auto h-full`}>
                           {renderGameContent()}
                           {!isScreenState && (
                                <button
                                    onClick={toggleTts}
                                    className={`absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10 ${isSpeaking ? 'animate-pulse' : ''}`}
                                    aria-label={isTtsEnabled ? 'Disable text-to-speech' : 'Enable text-to-speech'}
                                >
                                    {isTtsEnabled ? <SpeakerOnIcon className="w-7 h-7 text-green-400" /> : <SpeakerOffIcon className="w-7 h-7" />}
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {/* Actions Panel */}
                     {!isScreenState && (
                        <div className="md:col-span-1 flex flex-col items-center justify-start gap-2 order-3 pt-2 shrink-0">
                            <div className={`w-full grid ${gameState === GameState.EXPLORING ? 'grid-cols-4' : 'grid-cols-2'} md:grid-cols-2 gap-2`}>
                                {(gameState === GameState.EXPLORING || gameState === GameState.COMBAT) && (
                                    <button 
                                      onClick={() => setIsInventoryOpen(true)} 
                                      className="flex items-center justify-center text-lg bg-purple-700 hover:bg-purple-600 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold p-2 rounded-lg border-2 border-purple-500 transition-all duration-200 transform hover:scale-105" 
                                      disabled={!isPlayerTurn && gameState === GameState.COMBAT}
                                      aria-label="Inventory"
                                    >
                                        <BagIcon className="w-7 h-7" />
                                    </button>
                                )}
                                <button 
                                    onClick={() => setIsLogOpen(true)}
                                    className="flex items-center justify-center text-lg bg-yellow-700 hover:bg-yellow-600 text-white font-bold p-2 rounded-lg border-2 border-yellow-500 transition-all duration-200 transform hover:scale-105"
                                    aria-label="Log"
                                >
                                    <BookIcon className="w-7 h-7"/>
                                </button>
                                {gameState === GameState.EXPLORING && (
                                    <>
                                        <button 
                                          onClick={() => setIsMapOpen(true)} 
                                          className="flex items-center justify-center text-lg bg-teal-700 hover:bg-teal-600 text-white font-bold p-2 rounded-lg border-2 border-teal-500 transition-all duration-200 transform hover:scale-105"
                                          aria-label="Map"
                                        >
                                           <MapIcon className="w-7 h-7"/>
                                        </button>
                                        <button 
                                          onClick={saveGame} 
                                          className="flex items-center justify-center text-lg bg-indigo-700 hover:bg-indigo-600 text-white font-bold p-2 rounded-lg border-2 border-indigo-500 transition-all duration-200 transform hover:scale-105"
                                          aria-label="Save Game"
                                        >
                                            <SaveIcon className="w-7 h-7" />
                                        </button>
                                    </>
                                )}
                            </div>
                            {gameState === GameState.COMBAT && !isPlayerTurn && (
                                <div className="text-center text-yellow-400 font-press-start animate-pulse mt-2">Enemy Turn...</div>
                            )}
                        </div>
                     )}
                </div>
            </div>
        </main>
    );
};

export default App;