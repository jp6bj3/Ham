import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PenLine, Save, X, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';

const ProductNotes = ({ productId, savedNotes, onSaveNote }) => {
  const [notes, setNotes] = useState(savedNotes || []);
  const [newNote, setNewNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Update notes when savedNotes changes
  useEffect(() => {
    setNotes(savedNotes || []);
  }, [savedNotes]);

  const handleAddNote = () => {
    if (newNote.trim()) {
      const updatedNotes = [...notes, {
        id: Date.now(),
        text: newNote.trim(),
        timestamp: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }];
      setNotes(updatedNotes);
      onSaveNote(updatedNotes);
      setNewNote('');
      setIsEditing(false);
    }
  };

  const handleDeleteNote = (noteId) => {
    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);
    onSaveNote(updatedNotes);
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditingText(note.text);
  };

  const handleSaveEdit = (noteId) => {
    if (editingText.trim()) {
      const updatedNotes = notes.map(note => 
        note.id === noteId ? {
          ...note,
          text: editingText.trim(),
          lastModified: new Date().toISOString()
        } : note
      );
      setNotes(updatedNotes);
      onSaveNote(updatedNotes);
      setEditingNoteId(null);
      setEditingText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingText('');
  };

  const handleKeyPress = (e, isEditing = false, noteId = null) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isEditing) {
        handleSaveEdit(noteId);
      } else {
        handleAddNote();
      }
    }
  };

  return (
    <div className="border-t pt-4 mt-2">
      <div className="flex items-center justify-between mb-2">
        <div 
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <span className="text-sm font-medium flex items-center gap-1">
            <PenLine className="w-4 h-4" />
            筆記
            {notes.length > 0 && (
              <span className="text-xs text-gray-500">
                ({notes.length})
              </span>
            )}
          </span>
        </div>
        
        {!isEditing && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setIsExpanded(true);
            }}
            className="text-xs"
          >
            新增筆記
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {isEditing && (
            <div className="flex gap-2">
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e)}
                placeholder="輸入筆記內容..."
                className="flex-1 text-sm"
                autoFocus
              />
              <Button 
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                size="sm"
              >
                <Save className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setNewNote('');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {notes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-2">
                尚未有任何筆記
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {notes.map((note) => (
                  <div 
                    key={note.id} 
                    className="group flex items-start gap-2 p-2 rounded hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      {editingNoteId === note.id ? (
                        <div className="flex gap-2">
                          <Input
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyPress={(e) => handleKeyPress(e, true, note.id)}
                            className="flex-1 text-sm"
                            autoFocus
                          />
                          <Button 
                            onClick={() => handleSaveEdit(note.id)}
                            disabled={!editingText.trim()}
                            size="sm"
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {note.text}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-gray-400">
                              建立時間: {new Date(note.timestamp).toLocaleString()}
                              {note.lastModified !== note.timestamp && (
                                <span className="ml-2">
                                  (已編輯: {new Date(note.lastModified).toLocaleString()})
                                </span>
                              )}
                            </p>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditNote(note)}
                                className="h-6 w-6 p-0"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteNote(note.id)}
                                className="h-6 w-6 p-0"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductNotes;