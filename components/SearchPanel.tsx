import React, { useState, useEffect, useMemo, useRef } from 'react';
import Icon from './Icon';
import { SearchResult, SearchMatch } from '../types';

interface SearchPanelProps {
  onSearch: (query: string, options: { isCaseSensitive: boolean, isRegex: boolean, isWholeWord: boolean }) => void;
  results: SearchResult[];
  onResultClick: (path: string, lineNumber: number) => void;
  activeMatch: { path: string; lineNumber: number } | null;
  onReplace: (path: string, match: SearchMatch, replaceText: string) => void;
  onReplaceAll: (results: SearchResult[], replaceText: string) => void;
  focusOn: 'search' | 'replace' | null;
  onFocusHandled: () => void;
}

const SearchPanel: React.FC<SearchPanelProps> = ({ 
    onSearch, 
    results, 
    onResultClick, 
    activeMatch,
    onReplace,
    onReplaceAll,
    focusOn,
    onFocusHandled
}) => {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isReplaceVisible, setReplaceVisible] = useState(false);
  const [options, setOptions] = useState({
    isCaseSensitive: false,
    isWholeWord: false,
    isRegex: false,
  });
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (focusOn === 'search') {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      onFocusHandled();
    } else if (focusOn === 'replace') {
      setReplaceVisible(true);
      // Wait for the next tick for the input to be rendered before focusing
      setTimeout(() => {
        replaceInputRef.current?.focus();
        replaceInputRef.current?.select();
      }, 0);
      onFocusHandled();
    }
  }, [focusOn, onFocusHandled]);

  // Debounced search-as-you-type logic
  useEffect(() => {
    if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(() => {
        onSearch(query, options);
    }, 300);

    return () => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
    };
  }, [query, options, onSearch]);

  useEffect(() => {
    // Automatically expand all files when new results come in.
    const newExpanded = new Set<string>();
    results.forEach(r => newExpanded.add(r.path));
    setExpandedFiles(newExpanded);
  }, [results]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
    }
    onSearch(query, options);
  };
  
  const totalResults = useMemo(() => results.reduce((sum, file) => sum + file.matches.length, 0), [results]);

  const allMatches = useMemo(() => {
      const flatMatches: { path: string; match: SearchMatch }[] = [];
      results.forEach(fileResult => {
          fileResult.matches.forEach(match => {
              flatMatches.push({ path: fileResult.path, match });
          });
      });
      return flatMatches;
  }, [results]);

  const activeMatchIndex = useMemo(() => {
      if (!activeMatch) return -1;
      return allMatches.findIndex(m => m.path === activeMatch.path && m.match.lineNumber === activeMatch.lineNumber);
  }, [activeMatch, allMatches]);

  const navigateToMatch = (index: number) => {
      if (index >= 0 && index < allMatches.length) {
          const { path, match } = allMatches[index];
          onResultClick(path, match.lineNumber);
      }
  };

  const handlePreviousMatch = () => {
      const newIndex = activeMatchIndex > 0 ? activeMatchIndex - 1 : allMatches.length - 1;
      navigateToMatch(newIndex);
  };

  const handleNextMatch = () => {
      const newIndex = activeMatchIndex < allMatches.length - 1 ? activeMatchIndex + 1 : 0;
      navigateToMatch(newIndex);
  };

  const toggleFileExpansion = (path: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const HighlightedText: React.FC<{ line: SearchMatch }> = ({ line }) => {
    const parts = [];
    let lastIndex = 0;
    line.matchRanges.forEach((range, i) => {
      if (range.start > lastIndex) {
        parts.push(line.content.substring(lastIndex, range.start));
      }
      parts.push(
        <mark key={i} className="bg-transparent text-yellow-600 dark:text-yellow-400 font-bold px-0">
          {line.content.substring(range.start, range.start + range.length)}
        </mark>
      );
      lastIndex = range.start + range.length;
    });
    if (lastIndex < line.content.length) {
      parts.push(line.content.substring(lastIndex));
    }
    return <>{parts}</>;
  };

  return (
    <div className="bg-white dark:bg-[#252526] h-full flex flex-col text-slate-700 dark:text-slate-300">
      <div className="bg-slate-100 dark:bg-[#252526] px-4 h-[37px] flex items-center border-b border-slate-300 dark:border-slate-700/50">
        <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">
          Search
        </h3>
      </div>
      
      <div className="p-3 border-b border-slate-300 dark:border-slate-700/50">
        <form onSubmit={handleSearchSubmit}>
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => setReplaceVisible(v => !v)}
              data-tooltip="Toggle Replace"
              className="p-1.5 rounded self-start hover:bg-slate-200 dark:hover:bg-slate-700/50"
            >
              <Icon name={isReplaceVisible ? 'expand_more' : 'chevron_right'} className="text-lg" />
            </button>
            <div className="flex-1 flex flex-col gap-2">
              <div className="relative flex items-center">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-md py-1.5 px-2 text-sm placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 pr-24"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                    <button type="button" onClick={() => setOptions(o => ({...o, isCaseSensitive: !o.isCaseSensitive}))} data-tooltip="Match Case" className={`p-1.5 rounded ${options.isCaseSensitive ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}>
                        <Icon name="match_case" className="text-lg" />
                    </button>
                     <button type="button" onClick={() => setOptions(o => ({...o, isWholeWord: !o.isWholeWord}))} data-tooltip="Match Whole Word" className={`p-1.5 rounded ${options.isWholeWord ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}>
                        <Icon name="match_word" className="text-lg" />
                    </button>
                     <button type="button" onClick={() => setOptions(o => ({...o, isRegex: !o.isRegex}))} data-tooltip="Use Regular Expression" className={`p-1.5 rounded ${options.isRegex ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}>
                        <Icon name="regular_expression" className="text-lg" />
                    </button>
                </div>
              </div>
              
              {isReplaceVisible && (
                 <div className="flex items-center gap-2">
                    <input
                      ref={replaceInputRef}
                      type="text"
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      placeholder="Replace"
                      className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-md py-1.5 px-2 text-sm placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                    />
                    <button type="button" onClick={() => onReplaceAll(results, replaceText)} disabled={!totalResults || !replaceText} data-tooltip="Replace All" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed">
                       <Icon name="checklist" className="text-lg" />
                    </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {query && (
        <div className="px-3 py-1 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50">
            <span>
                {totalResults} result{totalResults !== 1 ? 's' : ''} in {results.length} file{results.length !== 1 ? 's' : ''}
            </span>
            {totalResults > 0 && (
                <div className='flex items-center gap-1'>
                     <button onClick={handlePreviousMatch} data-tooltip="Previous Match" className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Icon name="arrow_upward" className="text-base" />
                    </button>
                     <button onClick={handleNextMatch} data-tooltip="Next Match" className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Icon name="arrow_downward" className="text-base" />
                    </button>
                </div>
            )}
        </div>
      )}

      <div className="flex-1 p-2 overflow-y-auto text-sm">
        {results.map(fileResult => (
          <div key={fileResult.path} className="mb-1">
            <button
              onClick={() => toggleFileExpansion(fileResult.path)}
              className="w-full flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/50"
            >
              <Icon name={expandedFiles.has(fileResult.path) ? 'expand_more' : 'chevron_right'} className="text-lg" />
              <Icon name={fileResult.path.endsWith('.tsx') ? 'code' : 'article'} className="text-lg text-blue-500" />
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{fileResult.path.split('/').pop()}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{fileResult.path.substring(0, fileResult.path.lastIndexOf('/'))}</span>
              <span className="ml-auto text-xs bg-slate-300 dark:bg-slate-600 rounded-full px-2 py-0.5">{fileResult.matches.length}</span>
            </button>
            {expandedFiles.has(fileResult.path) && (
              <div className="mt-1 pl-4">
                {fileResult.matches.map(match => (
                    <div 
                        key={`${fileResult.path}:${match.lineNumber}`}
                        className={`group w-full flex items-start gap-1.5 py-0.5 pr-1 pl-2 rounded ${activeMatch?.path === fileResult.path && activeMatch.lineNumber === match.lineNumber ? 'bg-blue-500/20' : ''}`}
                    >
                        <button
                            onClick={() => onResultClick(fileResult.path, match.lineNumber)}
                            className="flex-1 flex items-start gap-3 text-left hover:bg-slate-200/50 dark:hover:bg-slate-700/30 rounded-l-md p-1"
                        >
                            <span className="text-slate-500 dark:text-slate-400 text-right min-w-[3ch] mt-0.5">{match.lineNumber}</span>
                            <div className="truncate font-mono text-xs mt-0.5 text-slate-600 dark:text-slate-300">
                                <HighlightedText line={match} />
                            </div>
                        </button>
                        <button
                            onClick={() => onReplace(fileResult.path, match, replaceText)}
                            disabled={!replaceText}
                            title="Replace"
                            className="p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-slate-300 dark:hover:bg-slate-600/50 disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                            <Icon name="find_replace" className="text-base" />
                        </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchPanel;