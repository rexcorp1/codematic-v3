import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from './Icon';
import { useTheme } from '../contexts/ThemeContext';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebContainer, WebContainerProcess } from '@webcontainer/api';

// Interface for a terminal instance
interface TerminalInstance {
  id: string;
  name: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  process: WebContainerProcess;
}

interface TerminalPanelProps {
    isCollapsed: boolean;
    onToggle: () => void;
    webContainer: WebContainer | null;
    onMount: (writer: (data: string) => void) => void;
    logs: string;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ isCollapsed, onToggle, webContainer, onMount, logs }) => {
    const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
    const [activeTerminalId, setActiveTerminalId] = useState<string>('CONSOLE');
    const { resolvedTheme } = useTheme();
    
    // Use a ref to hold a map of DOM elements for each terminal
    const terminalContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
    
    const terminalCounter = useRef(0);
    const panelContentRef = useRef<HTMLDivElement>(null);

    // The core logic for creating a new terminal session
    const createNewTerminal = useCallback(async () => {
        if (!webContainer) {
            console.error("WebContainer not available to create terminal.");
            return;
        }
        
        terminalCounter.current += 1;
        const newId = `term_${Date.now()}`;
        const newName = `jsh-${terminalCounter.current}`;

        const term = new Terminal({
            cursorBlink: true,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 14,
            theme: resolvedTheme === 'dark' 
                ? { background: '#0d1117', foreground: '#e5e7eb', cursor: '#ffffff' }
                : { background: '#ffffff', foreground: '#1f2937', cursor: '#000000' }
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        const shellProcess = await webContainer.spawn('jsh', ['--no-rc']);
        
        shellProcess.output.pipeTo(new WritableStream({
            write(data) { term.write(data); }
        }));

        const input = shellProcess.input.getWriter();
        term.onData(data => { input.write(data); });

        const newTerminalInstance: TerminalInstance = {
            id: newId,
            name: newName,
            terminal: term,
            fitAddon: fitAddon,
            process: shellProcess
        };

        setTerminals(prev => [...prev, newTerminalInstance]);
        setActiveTerminalId(newId);

    }, [webContainer, resolvedTheme]);

    // Effect to mount the terminal to its container DIV when it's created and visible
    useEffect(() => {
        const activeTerminal = terminals.find(t => t.id === activeTerminalId);
        if (activeTerminal && terminalContainerRefs.current[activeTerminal.id] && !activeTerminal.terminal.element) {
            const container = terminalContainerRefs.current[activeTerminal.id];
            if (container) {
                activeTerminal.terminal.open(container);
                activeTerminal.fitAddon.fit();
                activeTerminal.terminal.writeln(`\x1b[1;34mWelcome to ${activeTerminal.name}\x1b[0m`);
                activeTerminal.terminal.focus();
            }
        }
    }, [terminals, activeTerminalId]);

    // BUG FIX and RESIZE HANDLING: Use ResizeObserver
    useEffect(() => {
        const panelEl = panelContentRef.current;
        if (!panelEl) return;

        const resizeObserver = new ResizeObserver(() => {
            const activeTerminal = terminals.find(t => t.id === activeTerminalId);
            if (activeTerminal) {
                setTimeout(() => activeTerminal.fitAddon.fit(), 50);
            }
        });

        resizeObserver.observe(panelEl);

        return () => resizeObserver.disconnect();
    }, [terminals, activeTerminalId]);


    const handleCloseTerminal = (id: string) => {
        const terminalToClose = terminals.find(t => t.id === id);
        if (!terminalToClose) return;
        
        terminalToClose.process.kill();
        terminalToClose.terminal.dispose();

        const remainingTerminals = terminals.filter(t => t.id !== id);
        setTerminals(remainingTerminals);

        if (activeTerminalId === id) {
            if (remainingTerminals.length > 0) {
                setActiveTerminalId(remainingTerminals[remainingTerminals.length - 1].id);
            } else {
                setActiveTerminalId('CONSOLE');
            }
        }
    };
    
    const clearActiveTerminal = () => {
        if (activeTerminalId === 'CONSOLE') return;
        const active = terminals.find(t => t.id === activeTerminalId);
        active?.terminal.clear();
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            terminals.forEach(t => {
                try {
                    t.process.kill();
                    t.terminal.dispose();
                } catch (e) {
                    console.warn("Error cleaning up terminal:", e);
                }
            });
        }
    }, [terminals]);


    return (
        <div className="bg-white dark:bg-[#1e1e1e] h-full flex flex-col border-t border-slate-300 dark:border-slate-700/50">
            {/* Header with dynamic tabs */}
            <div className="bg-slate-100 dark:bg-[#252526] flex items-center justify-between shrink-0">
                <div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-400 overflow-x-auto">
                    {/* Console Tab */}
                    <button
                        onClick={() => setActiveTerminalId('CONSOLE')}
                        className={`px-4 py-2 border-r border-slate-300 dark:border-slate-700/50 transition-colors flex items-center gap-2 flex-shrink-0 ${activeTerminalId === 'CONSOLE' ? 'bg-white dark:bg-[#1e1e1e] text-slate-900 dark:text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700/20'}`}
                    >
                        CONSOLE
                    </button>
                    {/* Terminal Tabs */}
                    {terminals.map(term => (
                        <button
                            key={term.id}
                            onClick={() => setActiveTerminalId(term.id)}
                            className={`pl-4 pr-2 py-2 border-r border-slate-300 dark:border-slate-700/50 transition-colors flex items-center gap-2 flex-shrink-0 ${activeTerminalId === term.id ? 'bg-white dark:bg-[#1e1e1e] text-slate-900 dark:text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700/20'}`}
                        >
                           <span>{term.name}</span>
                           <Icon name="close" onClick={(e) => { e.stopPropagation(); handleCloseTerminal(term.id); }} className="text-sm p-0.5 rounded-full hover:bg-slate-400/50" />
                        </button>
                    ))}
                    {/* New Terminal Button */}
                    <button onClick={createNewTerminal} disabled={!webContainer} data-tooltip="New Terminal" className="px-2 py-2 border-r border-slate-300 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700/20 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Icon name="add" className="text-base" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center text-slate-600 dark:text-slate-400 px-2 flex-shrink-0">
                    {activeTerminalId !== 'CONSOLE' && (
                        <div className="flex items-center gap-1 mr-2">
                            <button onClick={clearActiveTerminal} data-tooltip="Clear Terminal" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700/50">
                                <Icon name="delete" className="text-lg" />
                            </button>
                            <button onClick={createNewTerminal} data-tooltip="Split Terminal (creates new)" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700/50">
                                <Icon name="splitscreen" className="text-lg" />
                            </button>
                        </div>
                    )}
                    <button
                        className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700/20"
                        onClick={onToggle}
                    >
                        <Icon name={isCollapsed ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {!isCollapsed && (
                <div ref={panelContentRef} className="flex-1 overflow-hidden bg-white dark:bg-[#0d1117] text-sm text-slate-800 dark:text-slate-300 relative">
                    {/* Console Panel */}
                    <div className="p-2 font-mono text-xs h-full overflow-auto" style={{ display: activeTerminalId === 'CONSOLE' ? 'block' : 'none' }}>
                        {logs ? (
                            <pre className="whitespace-pre-wrap break-words">{logs}</pre>
                        ) : (
                            <div className="p-2 font-sans text-slate-600 dark:text-slate-400">
                                Console logs from installation and the development server will appear here.
                            </div>
                        )}
                    </div>
                    
                    {/* Terminal Instance Panels */}
                    {terminals.map(term => (
                        <div
                            key={term.id}
                            ref={el => { terminalContainerRefs.current[term.id] = el; }}
                            className="w-full h-full p-2"
                            style={{ display: activeTerminalId === term.id ? 'block' : 'none' }}
                        />
                    ))}
                </div>
            )}
      </div>
    );
};

export default TerminalPanel;