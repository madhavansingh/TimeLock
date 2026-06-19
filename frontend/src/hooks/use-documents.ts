'use client';

import { useState, useEffect } from 'react';
import { ApiService } from '../services/api.service';
import { Document } from '../types';

export function useDocuments(filters: { status?: string; notaryId?: string } = {}) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiService.searchDocuments(filters);
      setDocuments(data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [filters.status, filters.notaryId]);

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments
  };
}
