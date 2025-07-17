import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// Utilities
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// === THEME COLORS ===
const THEME_COLORS = {
  primary: "#1565c0",
  secondary: "#64b5f6",
  accent: "#ffca28",
};

// ==========================
// AUTH HOOKS & API CLIENT ===
// ==========================
function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("access_token") || "");
  const [loading, setLoading] = useState(false);

  // PUBLIC_INTERFACE
  const login = async (username, password) => {
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);
      const resp = await fetch(`${BACKEND_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData.toString(),
      });
      if (!resp.ok) throw new Error("Invalid credentials");
      const data = await resp.json();
      localStorage.setItem("access_token", data.access_token);
      setToken(data.access_token);
      await fetchCurrentUser(data.access_token);
      setLoading(false);
      return true;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  // PUBLIC_INTERFACE
  const register = async ({username, email, password}) => {
    setLoading(true);
    try {
      const body = JSON.stringify({username, email, password});
      const resp = await fetch(`${BACKEND_URL}/auth/register`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err?.detail?.[0]?.msg || "Registration failed");
      }
      setLoading(false);
      return true;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  // PUBLIC_INTERFACE
  const logout = () => {
    localStorage.removeItem("access_token");
    setToken("");
    setUser(null);
  };

  // PUBLIC_INTERFACE
  const fetchCurrentUser = useCallback(async (overrideToken) => {
    const access = overrideToken || token;
    if (!access) return;
    setLoading(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/users/me`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      if (resp.status === 401) { logout(); return; }
      const userData = await resp.json();
      setUser(userData);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchCurrentUser();
  }, [token, fetchCurrentUser]);

  return { user, token, loading, login, register, logout };
}

// ==========================
// API CLIENT HOOKS
// ==========================
function useNotesAPI(token) {
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // NOTES
  const fetchNotes = async (q = {}) => {
    const url = new URL(`${BACKEND_URL}/notes/`);
    Object.entries(q).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.append(k, v);
    });
    const resp = await fetch(url, { headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to fetch notes");
    return await resp.json();
  };

  const createNote = async (note) => {
    const resp = await fetch(`${BACKEND_URL}/notes/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(note),
    });
    if (!resp.ok) throw new Error("Failed to create note");
    return await resp.json();
  };

  const updateNote = async (note_id, note) => {
    const resp = await fetch(`${BACKEND_URL}/notes/${note_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(note),
    });
    if (!resp.ok) throw new Error("Failed to update note");
    return await resp.json();
  };

  const deleteNote = async (note_id) => {
    const resp = await fetch(`${BACKEND_URL}/notes/${note_id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (!resp.ok) throw new Error("Failed to delete note");
    return true;
  };

  // FOLDERS
  const fetchFolders = async () => {
    const resp = await fetch(`${BACKEND_URL}/folders/`, { headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to fetch folders");
    return await resp.json();
  };

  const createFolder = async (name) => {
    const resp = await fetch(`${BACKEND_URL}/folders/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ name }),
    });
    if (!resp.ok) throw new Error("Failed to create folder");
    return await resp.json();
  };

  // TAGS
  const fetchTags = async () => {
    const resp = await fetch(`${BACKEND_URL}/tags/`, { headers: authHeaders });
    if (!resp.ok) throw new Error("Failed to fetch tags");
    return await resp.json();
  };

  const createTag = async (name) => {
    const resp = await fetch(`${BACKEND_URL}/tags/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ name }),
    });
    if (!resp.ok) throw new Error("Failed to create tag");
    return await resp.json();
  };

  return {
    fetchNotes, createNote, updateNote, deleteNote,
    fetchFolders, createFolder,
    fetchTags, createTag
  };
}

// ==========================
// COMPONENTS
// ==========================

// ----- AUTH UI: Login/Register -----
function AuthPage({ onAuthSuccess, authModeDefault = "login" }) {
  const [authMode, setAuthMode] = useState(authModeDefault);
  const [form, setForm] = useState({ username: "", password: "", email: "" });
  const [error, setError] = useState("");
  const { login, register, loading } = useAuth();

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    try {
      if (authMode === "login") {
        await login(form.username, form.password);
      } else {
        await register({ ...form });
      }
      onAuthSuccess();
    } catch (err) {
      setError(err.message || "Authentication failed");
    }
  };

  return (
    <div className="auth-container">
      <h2>{authMode === "login" ? "Login" : "Sign Up"}</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <input name="username" placeholder="Username" value={form.username} onChange={handleChange} required />
        {authMode === "register" && (
          <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        )}
        <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required minLength={6} />
        <button type="submit" className="btn-primary" disabled={loading}>
          {authMode === "login" ? "Login" : "Register"}
        </button>
        {error && <div className="error-msg">{error}</div>}
      </form>
      <div className="auth-switch">
        {authMode === "login" ?
          <span>Don't have an account? <button className="link-btn" onClick={() => setAuthMode("register")}>Sign Up</button></span>
          :
          <span>Already have an account? <button className="link-btn" onClick={() => setAuthMode("login")}>Login</button></span>
        }
      </div>
    </div>
  );
}

// ==== Navigation Bar ====
function Navbar({ user, onLogout, onThemeToggle, theme }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand" style={{ color: THEME_COLORS.primary }}>
        <b>Note<span style={{ color: THEME_COLORS.accent }}>Flow</span></b>
      </div>
      <div className="navbar-actions">
        <span className="navbar-username">
          {user ? `Hi, ${user.username}` : ""}
        </span>
        <button className="btn-outline" aria-label="Toggle theme" onClick={onThemeToggle}>
          {theme === "light" ? "🌙" : "☀️"}
        </button>
        <button className="btn-outline" onClick={onLogout}>Logout</button>
      </div>
    </nav>
  );
}

// ==== Sidebar (Folders/Tags) ====
function Sidebar({ 
  folders, tags, selectedFolder, onFolderSelect, onNewFolder, 
  selectedTag, onTagSelect, onNewTag 
}) {
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagName, setTagName] = useState("");
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-title-row">
          <span>Folders</span>
          <button className="add-btn" onClick={() => setShowFolderInput(v => !v)}>+</button>
        </div>
        {showFolderInput && (
          <form className="inline-form" onSubmit={e => { e.preventDefault(); if (folderName) { onNewFolder(folderName); setFolderName(""); setShowFolderInput(false); }}}>
            <input autoFocus value={folderName} onChange={e => setFolderName(e.target.value)} maxLength={100} placeholder="New Folder Name" />
            <button className="btn-small" type="submit">Add</button>
          </form>
        )}
        <ul className="sidebar-list">
          <li className={!selectedFolder ? "active" : ""} onClick={() => onFolderSelect(null)}>All Notes</li>
          {folders.map(folder => (
            <li key={folder.id} className={selectedFolder === folder.id ? "active" : ""} onClick={() => onFolderSelect(folder.id)}>
              {folder.name}
            </li>
          ))}
        </ul>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-title-row">
          <span>Tags</span>
          <button className="add-btn" onClick={() => setShowTagInput(v => !v)}>+</button>
        </div>
        {showTagInput && (
          <form className="inline-form" onSubmit={e => { e.preventDefault(); if (tagName) { onNewTag(tagName); setTagName(""); setShowTagInput(false); }}}>
            <input autoFocus value={tagName} onChange={e => setTagName(e.target.value)} maxLength={50} placeholder="New Tag Name" />
            <button className="btn-small" type="submit">Add</button>
          </form>
        )}
        <ul className="sidebar-list tag-list">
          <li className={!selectedTag ? "active" : ""} onClick={() => onTagSelect(null)}>All Tags</li>
          {tags.map(tag => (
            <li key={tag.id} className={selectedTag === tag.id ? "active" : ""} onClick={() => onTagSelect(tag.id)}>
              {tag.name}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

// ==== Notes List and Sort/Search ====
function NotesList({
  notes, selectedNoteId, onNoteSelect, onSort,
  onSearch, sortBy, sortOrder, searchQuery
}) {
  return (
    <div className="notes-list-container">
      <div className="notes-list-toolbar">
        <input
          className="search-bar"
          placeholder="Search notes…"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
        />
        <div className="sort-options">
          <label>Sort:</label>
          <select value={sortBy} onChange={e => onSort(e.target.value, sortOrder)}>
            <option value="created_at">Created</option>
            <option value="updated_at">Updated</option>
            <option value="title">Title</option>
          </select>
          <button
            className="btn-small"
            aria-label="Toggle sort order"
            onClick={() => onSort(sortBy, sortOrder === "desc" ? "asc" : "desc")}
          >
            {sortOrder === "desc" ? "↓" : "↑"}
          </button>
        </div>
      </div>
      <ul className="notes-list">
        {notes.map(note => (
          <li
            key={note.id}
            className={selectedNoteId === note.id ? "note-item active" : "note-item"}
            onClick={() => onNoteSelect(note.id)}
          >
            <div className="note-title">{note.title}</div>
            <div className="note-tags">
              {(note.tags || []).map(tag => (
                <span className="tag-badge" key={tag}>{tag}</span>
              ))}
            </div>
            <time className="note-time" dateTime={note.updated_at || note.created_at}>
              {(note.updated_at || note.created_at || '').replace('T', ' ').substring(0, 16)}
            </time>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ==== Note Editor/Create ====
function NoteEditor({
  note, onSave, onDelete, folders, tags, saving, onCancel
}) {
  const [form, setForm] = useState({
    title: note?.title || "",
    content: note?.content || "",
    folder_id: note?.folder_id || "",
    tag_ids: note?.tags ? [] : []
  });

  useEffect(() => {
    setForm({
      title: note?.title || "",
      content: note?.content || "",
      folder_id: note?.folder_id || "",
      tag_ids: note?.tag_ids || [],
    });
  }, [note]);

  const [error, setError] = useState("");

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };
  const handleTagToggle = tagId => {
    setForm(f => ({
      ...f,
      tag_ids: f.tag_ids.includes(tagId)
        ? f.tag_ids.filter(tid => tid !== tagId)
        : [...(f.tag_ids || []), tagId]
    }));
  };
  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    try {
      await onSave({ ...form, folder_id: form.folder_id || null, tag_ids: form.tag_ids || [] });
    } catch (e) {
      setError(e.message || "Save failed");
    }
  };

  return (
    <form className="note-editor" onSubmit={handleSubmit}>
      <input
        className="note-title-input"
        name="title"
        placeholder="Note Title"
        value={form.title}
        onChange={handleChange}
        maxLength={200}
        required
        autoFocus
      />
      <textarea
        className="note-content-input"
        name="content"
        placeholder="Write your note here..."
        value={form.content}
        onChange={handleChange}
        rows={10}
      />
      <div className="note-meta-row">
        <select
          name="folder_id"
          value={form.folder_id || ""}
          onChange={handleChange}
        >
          <option value="">No Folder</option>
          {folders.map(folder => (
            <option key={folder.id} value={folder.id}>{folder.name}</option>
          ))}
        </select>
        <div className="tags-input">
          <span>Tags:</span>
          {tags.map(tag => (
            <label key={tag.id} className="tag-label">
              <input
                type="checkbox"
                checked={(form.tag_ids || []).includes(tag.id)}
                onChange={() => handleTagToggle(tag.id)}
              />
              <span className="tag-badge">{tag.name}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="editor-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {note ? "Save" : "Create"}
        </button>
        {note && <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>}
        {note && <button type="button" className="btn-danger" onClick={() => { if (window.confirm("Delete this note?")) onDelete(); }}>Delete</button>}
        {error && <span className="error-msg">{error}</span>}
      </div>
    </form>
  );
}

// ==========================
// MAIN APP
// ==========================
function App() {
  const [theme, setTheme] = useState('light');
  const { user, token, login, register, logout } = useAuth();
  const notesAPI = useNotesAPI(token);

  // UI state
  const [folders, setFolders] = useState([]);
  const [tags, setTags] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [editorMode, setEditorMode] = useState(null); // null | "new" | "edit"
  const [savingNote, setSavingNote] = useState(false);

  // Fetch folders, tags, and notes on login or relevant changes
  const loadFolders = useCallback(() => notesAPI.fetchFolders().then(setFolders).catch(()=>{}), [notesAPI]);
  const loadTags = useCallback(() => notesAPI.fetchTags().then(setTags).catch(()=>{}), [notesAPI]);
  const loadNotes = useCallback(() => {
    let query = {
      folder_id: selectedFolder || undefined,
      sort_by: sortBy,
      order: sortOrder,
      search: searchQuery || undefined
    };
    notesAPI.fetchNotes(query).then(setNotes).catch(()=>{});
  // eslint-disable-next-line
  }, [notesAPI, selectedFolder, sortBy, sortOrder, searchQuery]);

  useEffect(() => { if (token) loadFolders(); }, [token, loadFolders]);
  useEffect(() => { if (token) loadTags(); }, [token, loadTags]);
  useEffect(() => { if (token) loadNotes(); }, [token, loadNotes, selectedFolder, sortBy, sortOrder, searchQuery]);

  // Clear note selection/editor if list/folder/tag changes
  useEffect(() => {
    setSelectedNoteId(null);
    setEditorMode(null);
  }, [selectedFolder, selectedTag]);

  // Create Folder
  const handleNewFolder = async (name) => {
    await notesAPI.createFolder(name);
    loadFolders();
  };

  // Create Tag
  const handleNewTag = async (name) => {
    await notesAPI.createTag(name);
    loadTags();
  };

  // CRUD - Create / Edit / Delete Note
  const handleCreateNote = async (note) => {
    setSavingNote(true);
    await notesAPI.createNote(note);
    setSavingNote(false);
    setEditorMode(null);
    loadNotes();
  };
  const handleEditNote = async (note) => {
    setSavingNote(true);
    await notesAPI.updateNote(selectedNoteId, note);
    setSavingNote(false);
    setEditorMode(null);
    loadNotes();
  };
  const handleDeleteNote = async () => {
    setSavingNote(true);
    await notesAPI.deleteNote(selectedNoteId);
    setSavingNote(false);
    setSelectedNoteId(null);
    setEditorMode(null);
    loadNotes();
  };

  // Note editor open/close
  const selectedNote = notes.find(n => n.id === selectedNoteId) || null;

  // Theming
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");

  // UI: If not logged in, show AuthPage
  if (!user) {
    return (
      <div className="App full-bg">
        <div className="auth-wrapper">
          <AuthPage onAuthSuccess={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  return (
    <div className="App notes-app">
      <Navbar user={user} onLogout={logout} onThemeToggle={toggleTheme} theme={theme} />
      <div className="main-layout">
        <Sidebar
          folders={folders} tags={tags}
          selectedFolder={selectedFolder}
          onFolderSelect={fid => {setSelectedFolder(fid); setSearchQuery("");}}
          onNewFolder={handleNewFolder}
          selectedTag={selectedTag}
          onTagSelect={tid => setSelectedTag(tid)}
          onNewTag={handleNewTag}
        />
        <main className="notes-main">
          <div className="toolbar-row">
            <button className="btn-primary" onClick={() => { setEditorMode("new"); setSelectedNoteId(null); }}>+ New Note</button>
          </div>
          <div className="notes-content-row">
            <NotesList
              notes={notes.filter(n => !selectedTag || (n.tags_ids || []).includes(selectedTag))}
              selectedNoteId={selectedNoteId}
              onNoteSelect={nid => { setSelectedNoteId(nid); setEditorMode("edit"); }}
              onSort={(sf, so) => { setSortBy(sf); setSortOrder(so); }}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSearch={setSearchQuery}
              searchQuery={searchQuery}
            />
            <div className="editor-panel">
              {editorMode === "new" &&
                <NoteEditor
                  onSave={handleCreateNote}
                  folders={folders}
                  tags={tags}
                  saving={savingNote}
                  onCancel={() => setEditorMode(null)}
                />
              }
              {editorMode === "edit" && selectedNote &&
                <NoteEditor
                  note={selectedNote}
                  onSave={handleEditNote}
                  onDelete={handleDeleteNote}
                  folders={folders}
                  tags={tags}
                  saving={savingNote}
                  onCancel={() => setEditorMode(null)}
                />
              }
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
