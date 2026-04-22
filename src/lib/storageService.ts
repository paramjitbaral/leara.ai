import axios from 'axios';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { localStore } from './storage';

/**
 * Unified Storage Service
 * Handles synchronization between Server, Local (IndexedDB), and Cloud (Firestore)
 */

export const storageService = {
  /**
   * Save file content across all layers
   */
  async saveFile(userId: string, projectId: string, path: string, name: string, content: string, language?: string) {
    try {
      // 1. Server
      await axios.post('/api/files/save', { userId, path, content });

      // 2. Local
      await localStore.saveFile(projectId, {
        path,
        content,
        type: 'file',
        updatedAt: Date.now()
      });

      // 3. Cloud (Silently handle if unauthenticated or offline)
      if (db) {
        try {
          const fileId = path.replace(/\//g, '_');
          const fileRef = doc(db, 'projects', projectId, 'files', fileId);
          await setDoc(fileRef, {
            name,
            content,
            path,
            projectId,
            language: language || '',
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (cloudError) {
          console.warn('Cloud sync skipped:', cloudError);
        }
      }

      return true;
    } catch (error) {
      console.error('StorageService: Failed to save file', error);
      throw error;
    }
  },

  /**
   * Create a new file or directory across all layers
   */
  async createNode(userId: string, projectId: string, parentPath: string, name: string, type: 'file' | 'directory') {
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    try {
      // 1. Server
      await axios.post('/api/files/create', { userId, path: parentPath, type, name });

      // 2. Local
      await localStore.saveFile(projectId, {
        path: fullPath,
        content: '',
        type,
        updatedAt: Date.now()
      });

      // 3. Cloud
      if (db) {
        try {
          const fileId = fullPath.replace(/\//g, '_');
          const fileRef = doc(db, 'projects', projectId, 'files', fileId);
          await setDoc(fileRef, {
            name,
            type,
            path: fullPath,
            projectId,
            content: '',
            updatedAt: serverTimestamp()
          });
        } catch (cloudError) {
          console.warn('Cloud node creation skipped:', cloudError);
        }
      }

      return fullPath;
    } catch (error) {
      console.error('StorageService: Failed to create node', error);
      throw error;
    }
  },

  /**
   * Delete a node across all layers
   */
  async deleteNode(userId: string, projectId: string, path: string) {
    try {
      // 1. Server
      await axios.delete(`/api/files/delete?userId=${userId}&path=${path}`);

      // 2. Local
      await localStore.deleteFile(projectId, path);

      // 3. Cloud
      if (db) {
        try {
          const fileId = path.replace(/\//g, '_');
          await deleteDoc(doc(db, 'projects', projectId, 'files', fileId));
        } catch (cloudError) {
          console.warn('Cloud deletion skipped:', cloudError);
        }
      }

      return true;
    } catch (error) {
      console.error('StorageService: Failed to delete node', error);
      throw error;
    }
  },

  /**
   * Rename a node across all layers
   */
  async renameNode(userId: string, projectId: string, oldPath: string, newPath: string, newName: string) {
    try {
      // 1. Server
      await axios.put('/api/files/rename', { userId, oldPath, newPath });

      // 2. Local
      const files = await localStore.getProjectFiles(projectId);
      const oldFile = files.find(f => f.path === oldPath);
      await localStore.deleteFile(projectId, oldPath);
      await localStore.saveFile(projectId, {
        path: newPath,
        content: oldFile?.content || '',
        type: oldFile?.type || 'file',
        updatedAt: Date.now()
      });

      // 3. Cloud
      if (db) {
        try {
          const oldFileId = oldPath.replace(/\//g, '_');
          const newFileId = newPath.replace(/\//g, '_');
          const oldRef = doc(db, 'projects', projectId, 'files', oldFileId);
          const newRef = doc(db, 'projects', projectId, 'files', newFileId);
  
          // Get content from server to ensure we have the latest
          const res = await axios.get(`/api/files/content?userId=${userId}&path=${newPath}`);
  
          await setDoc(newRef, {
            name: newName,
            path: newPath,
            projectId,
            content: res.data.content,
            type: oldFile?.type || 'file',
            updatedAt: serverTimestamp()
          });
          await deleteDoc(oldRef);
        } catch (cloudError) {
          console.warn('Cloud rename skipped:', cloudError);
        }
      }

      return true;
    } catch (error) {
      console.error('StorageService: Failed to rename node', error);
      throw error;
    }
  },

  /**
   * Delete an entire project across all layers
   */
  async deleteProject(userId: string, projectId: string, folderName: string) {
    try {
      // 1. Firestore
      try {
        await deleteDoc(doc(db, 'projects', projectId));
      } catch (cloudError) {
        console.warn('Cloud project deletion skipped:', cloudError);
      }

      // 2. Server
      await axios.delete(`/api/files/delete?userId=${userId}&path=${folderName}`);

      // 3. Local
      await localStore.deleteProject(projectId);

      return true;
    } catch (error) {
      console.error('StorageService: Failed to delete project', error);
      throw error;
    }
  },

  /**
   * Batch backup multiple nodes (used for project creation/import)
   */
  async batchBackup(projectId: string, nodes: any[]) {
    let localFilesArray: any[] = [];

    const processNodes = async (items: any[]) => {
      for (const item of items) {
        // Local batching
        localFilesArray.push({
          path: item.id,
          content: item.content || '',
          type: item.type,
          updatedAt: Date.now()
        });

        // Cloud (Non-blocking)
        try {
          const fileId = item.id.replace(/\//g, '_');
          const fileRef = doc(db, 'projects', projectId, 'files', fileId);
          await setDoc(fileRef, {
            name: item.name,
            type: item.type,
            path: item.id,
            projectId,
            content: item.content || '',
            updatedAt: serverTimestamp()
          });
        } catch (e) {}

        if (item.children) {
          await processNodes(item.children);
        }
      }
    };

    await processNodes(nodes);

    // Perform a single batch save to IndexedDB at the end
    if (localFilesArray.length > 0) {
      await localStore.saveFiles(projectId, localFilesArray);
    }
  }
};
