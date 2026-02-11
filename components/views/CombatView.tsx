

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Enemy, EnemyAbility, Player, PlayerAbility, StatusEffectType, Element } from '../../types';
import { StatusBar } from '../StatusBar';
import { HealIcon, ShieldIcon, SwordIcon, RunIcon, FireIcon, BoltIcon, StarIcon } from '../icons';
import { useTypewriter } from '../../hooks/useTypewriter';
import { PLAYER_ABILITIES, STATUS_EFFECT_CONFIG } from '../../constants';

interface CombatViewProps {
  storyText: string;
  enemies: Enemy[];
  player: Player;
  isPlayerTurn: boolean;
  onCombatAction: (action: 'attack' | 'defend' | 'flee' | 'ability', payload?: any) => void;
}

interface DamagePopup {
    id: number;
    value: number;
    isCrit: boolean;
    enemyIndex: number;
}

const statusEffectIcons: Record<StatusEffectType, React.ReactNode> = {
    [StatusEffectType.BURN]: <FireIcon className="w-4 h-4 text-orange-400" />,
    [StatusEffectType.CHILL]: <span className="text-cyan-400">❄️</span>,
    [StatusEffectType.SHOCK]: <BoltIcon className="w-4 h-4 text-yellow-400" />,
    [StatusEffectType.GROUNDED]: <span className="text-amber-700">⛰️</span>,
    [StatusEffectType.EARTH_ARMOR]: <ShieldIcon className="w-4 h-4 text-green-500" />,
};

// Memoized Sub-Component for individual Enemies to prevent mass re-renders
const EnemyUnit = React.memo(({ enemy, index, damagePopups, onTarget }: { enemy: Enemy, index: number, damagePopups: DamagePopup[], onTarget: (index: number) => void }) => {
    const [isShaking, setIsShaking] = useState(false);
    
    // Trigger shake when a new damage popup appears
    useEffect(() => {
        if (damagePopups.length > 0) {
            setIsShaking(true);
            const timer = setTimeout(() => setIsShaking(false), 400); // Shake duration
            return () => clearTimeout(timer);
        }
    }, [damagePopups]);

    return (
        <button 
            onClick={() => onTarget(index)}
            className={`relative bg-gray-800/90 p-3 rounded-lg border-2 shadow-lg w-full sm:w-48 text-center transition-all duration-300 hover:scale-105 active:scale-95 group ${
                enemy.isShielded ? 'border-cyan-400 shadow-lg shadow-cyan-400/50 animate-pulse' : 'border-red-500/80 hover:border-red-400'
            } ${isShaking ? 'shake' : ''}`}
            disabled={enemy.hp <= 0}
        >
            {damagePopups.map(p => (
                <div key={p.id} className={`damage-popup ${p.isCrit ? 'crit' : ''}`}>
                    {p.isCrit ? 'CRIT! ' : ''}-{p.value}
                </div>
            ))}
            
            <div className="flex items-center justify-center gap-1.5 mb-2 relative z-10 flex-wrap">
                <h2 className="text-lg font-cinzel font-bold text-red-200 truncate max-w-[80%]" title={enemy.name}>{enemy.name}</h2>
                
                {/* Info Tooltip */}
                <div className="relative flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <div className="w-5 h-5 rounded-full border border-gray-500 text-gray-400 text-xs flex items-center justify-center cursor-help hover:bg-gray-700 hover:text-white transition-colors bg-gray-900 font-serif italic">i</div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-900/95 backdrop-blur-sm border border-yellow-500/30 text-white text-xs p-3 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] text-left font-sans">
                        <p className="font-bold font-cinzel text-yellow-500 mb-1 text-sm">{enemy.name}</p>
                        <p className="italic text-gray-300 mb-2 leading-relaxed font-serif">{enemy.description}</p>
                        <div className="border-t border-gray-700 pt-2 grid grid-cols-2 gap-x-2 gap-y-1 font-bold text-[10px] text-gray-400">
                                <span>ATK: <span className="text-gray-200">{enemy.attack}</span></span>
                                <span>HP: <span className="text-gray-200">{enemy.hp}/{enemy.maxHp}</span></span>
                                {enemy.element && enemy.element !== 'NONE' && <span className="col-span-2 text-blue-300">Element: {enemy.element}</span>}
                                {enemy.ability && <span className="col-span-2 text-purple-300">Ability: {enemy.ability}</span>}
                                {enemy.aiPersonality && <span className="col-span-2 text-green-300">AI: {enemy.aiPersonality}</span>}
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-yellow-500/30"></div>
                    </div>
                </div>

                {enemy.ability === EnemyAbility.HEAL && <HealIcon className="w-5 h-5 text-green-400" title="Heal Ability" />}
                {enemy.ability === EnemyAbility.SHIELD && <ShieldIcon className="w-5 h-5 text-cyan-400" title="Shield Ability" />}
                {enemy.ability === EnemyAbility.DRAIN_LIFE && <BoltIcon className="w-5 h-5 text-purple-400" title="Drain Life Ability" />}
                {enemy.ability === EnemyAbility.MULTI_ATTACK && <SwordIcon className="w-5 h-5 text-orange-400" title="Multi-Attack Ability" />}

                {/* Status Effects next to name */}
                {enemy.statusEffects.map(effect => (
                    <div key={effect.type} title={effect.type} className="animate-pulse">
                        {statusEffectIcons[effect.type]}
                    </div>
                ))}
            </div>

            <StatusBar currentValue={enemy.hp} maxValue={enemy.maxHp} colorClass="bg-red-600" label="" />
        </button>
    );
});

export const CombatView: React.FC<CombatViewProps> = ({ storyText, enemies, player, isPlayerTurn, onCombatAction }) => {
    const displayedText = useTypewriter(storyText, 20);
    const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
    const [selectedAbility, setSelectedAbility] = useState<PlayerAbility | null>(null);
    const [showAbilityMenu, setShowAbilityMenu] = useState(false);

    const triggerDamagePopup = useCallback((value: number, isCrit: boolean, enemyIndex: number) => {
        const newPopup = { id: Date.now() + Math.random(), value, isCrit, enemyIndex };
        setDamagePopups(prev => [...prev, newPopup]);
        setTimeout(() => {
            setDamagePopups(prev => prev.filter(p => p.id !== newPopup.id));
        }, 1000);
    }, []);

    const handleTargetClick = (enemyIndex: number) => {
        if (!isPlayerTurn) return;
        
        const target = enemies[enemyIndex];
        if (!target || target.hp <= 0) return;

        if (selectedAbility) {
            onCombatAction('ability', { 
                ability: selectedAbility, 
                targetIndex: enemyIndex,
                onDamageDealt: (dmg: number, crit: boolean) => triggerDamagePopup(dmg, crit, enemyIndex)
            });
            setSelectedAbility(null);
            setShowAbilityMenu(false);
        } else {
            // Basic Attack
            onCombatAction('attack', { 
                targetIndex: enemyIndex,
                onDamageDealt: (dmg: number, crit: boolean) => triggerDamagePopup(dmg, crit, enemyIndex)
            });
        }
    };

    const handleAbilitySelect = (ability: PlayerAbility) => {
        const details = PLAYER_ABILITIES[ability];
        // Check resources
        if (details.resource === 'MP' && player.mp < details.cost) return;
        if (details.resource === 'EP' && player.ep < details.cost) return;
        if (details.resource === 'SP' && player.sp < details.cost) return;

        // If self-cast/heal, execute immediately if damageMultiplier is 0
        if (details.damageMultiplier === 0) {
             // Pure buff/heal, safe to pass targetIndex 0 or ignore in reducer if logic supports it
             onCombatAction('ability', { ability, targetIndex: 0 }); 
             setShowAbilityMenu(false);
             return;
        }
        
        setSelectedAbility(ability);
        // Now wait for target selection
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Story Text */}
            <div className="flex-1 overflow-y-auto mb-4 p-2 bg-black/20 rounded-lg">
                <p className="text-lg md:text-xl font-serif leading-relaxed text-gray-200">{displayedText}</p>
            </div>

            {/* Enemies Grid */}
            <div className="flex flex-wrap justify-center gap-4 mb-20 animate-fade-in py-4">
                {enemies.map((enemy, index) => {
                    if (enemy.hp <= 0) return null; // Hide dead enemies
                    return (
                        <EnemyUnit 
                            key={index} 
                            index={index}
                            enemy={enemy} 
                            damagePopups={damagePopups.filter(p => p.enemyIndex === index)}
                            onTarget={handleTargetClick}
                        />
                    );
                })}
                 {enemies.every(e => e.hp <= 0) && (
                    <div className="text-yellow-400 font-bold text-2xl animate-bounce">VICTORY!</div>
                )}
            </div>

            {/* Ability Menu Overlay */}
            {showAbilityMenu && (
                <div className="absolute bottom-20 left-0 right-0 bg-gray-900/95 border-t-2 border-purple-500 p-4 rounded-t-xl z-20 animate-slide-up max-h-[50vh] overflow-y-auto shadow-2xl">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-cinzel font-bold text-purple-300 text-lg">Select Ability</h3>
                        <button onClick={() => { setShowAbilityMenu(false); setSelectedAbility(null); }} className="text-gray-400 hover:text-white font-bold px-2">✕</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {player.abilities.map(abilityName => {
                            const info = PLAYER_ABILITIES[abilityName];
                            const canAfford = 
                                (info.resource === 'MP' && player.mp >= info.cost) ||
                                (info.resource === 'EP' && player.ep >= info.cost) ||
                                (info.resource === 'SP' && player.sp >= info.cost);
                            
                            return (
                                <button
                                    key={abilityName}
                                    onClick={() => handleAbilitySelect(abilityName)}
                                    disabled={!canAfford}
                                    className={`text-left p-3 rounded border transition-all flex flex-col ${
                                        selectedAbility === abilityName 
                                        ? 'bg-purple-800 border-yellow-400 ring-2 ring-yellow-400/50' 
                                        : canAfford 
                                            ? 'bg-gray-800 border-gray-600 hover:bg-gray-700' 
                                            : 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
                                    }`}
                                >
                                    <div className="flex justify-between w-full">
                                        <span className="font-bold text-white">{info.name}</span>
                                        <span className={`text-xs font-bold ${canAfford ? 'text-blue-300' : 'text-red-400'}`}>{info.cost} {info.resource}</span>
                                    </div>
                                    <span className="text-xs text-gray-400 italic">{info.description}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Combat Actions Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gray-900 border-t border-gray-700 flex gap-2 justify-center z-10">
                {isPlayerTurn ? (
                    <>
                         <div className={`transition-all duration-300 ${selectedAbility ? 'w-full' : 'w-auto flex gap-2'}`}>
                            {selectedAbility ? (
                                <div className="flex items-center justify-between w-full bg-purple-900/50 px-4 py-2 rounded border border-purple-500 animate-pulse">
                                    <span className="text-white font-bold">Select Target for {selectedAbility}...</span>
                                    <button 
                                        onClick={() => setSelectedAbility(null)}
                                        className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm font-bold"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div 
                                        className="bg-red-700 text-white p-3 rounded-lg border-2 border-red-500 font-cinzel font-bold flex-1 sm:flex-none sm:w-32 active:scale-95 shadow-lg relative group flex flex-col items-center justify-center cursor-default opacity-80"
                                    >
                                        <SwordIcon className="w-6 h-6 mx-auto mb-1"/>
                                        <span className="text-xs">Tap Enemy</span>
                                    </div>

                                    <button 
                                        onClick={() => setShowAbilityMenu(!showAbilityMenu)}
                                        className={`bg-purple-700 hover:bg-purple-600 text-white p-3 rounded-lg border-2 border-purple-500 font-cinzel font-bold flex-1 sm:flex-none sm:w-32 active:scale-95 shadow-lg ${showAbilityMenu ? 'ring-2 ring-yellow-400' : ''}`}
                                    >
                                        <StarIcon className="w-6 h-6 mx-auto mb-1"/>
                                        <span className="text-xs">Skills</span>
                                    </button>

                                    <button 
                                        onClick={() => onCombatAction('defend')}
                                        className="bg-blue-700 hover:bg-blue-600 text-white p-3 rounded-lg border-2 border-blue-500 font-cinzel font-bold flex-1 sm:flex-none sm:w-32 active:scale-95 shadow-lg"
                                    >
                                        <ShieldIcon className="w-6 h-6 mx-auto mb-1"/>
                                        <span className="text-xs">Defend</span>
                                    </button>

                                    <button 
                                        onClick={() => onCombatAction('flee')}
                                        className="bg-gray-600 hover:bg-gray-500 text-white p-3 rounded-lg border-2 border-gray-400 font-cinzel font-bold flex-1 sm:flex-none sm:w-24 active:scale-95 shadow-lg"
                                    >
                                        <RunIcon className="w-6 h-6 mx-auto mb-1"/>
                                        <span className="text-xs">Flee</span>
                                    </button>
                                </>
                            )}
                         </div>
                    </>
                ) : (
                    <div className="w-full text-center py-3 text-gray-400 italic bg-gray-800 rounded border border-gray-700 animate-pulse">
                        Opponent's Turn...
                    </div>
                )}
            </div>
        </div>
    );
};
