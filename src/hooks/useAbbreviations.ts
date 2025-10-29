import { useState, useEffect } from 'react';

export interface Abbreviation {
  code: string;
  text: string;
}

const STORAGE_KEY = 'text-abbreviations';

export const useAbbreviations = () => {
  const [abbreviations, setAbbreviations] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load abbreviations from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setAbbreviations(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse abbreviations:', e);
      }
    } else {
      // Set default abbreviations
      const defaults = {
        "123": "Thank you for reaching out. I'll get back to you soon.",
        "sig": "Best regards,\nJohn Doe",
        "intro": "Hello! I hope you're doing well.",
        "tymsg": "Thank you for your message. I appreciate you taking the time to reach out."
      };
      setAbbreviations(defaults);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    }
  }, []);

  const saveAbbreviations = (newAbbreviations: Record<string, string>) => {
    setAbbreviations(newAbbreviations);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newAbbreviations));
  };

  const addAbbreviation = (code: string, text: string) => {
    const updated = { ...abbreviations, [code]: text };
    saveAbbreviations(updated);
  };

  const deleteAbbreviation = (code: string) => {
    const updated = { ...abbreviations };
    delete updated[code];
    saveAbbreviations(updated);
  };

  const getAbbreviation = (code: string): string | undefined => {
    return abbreviations[code];
  };

  return {
    abbreviations,
    addAbbreviation,
    deleteAbbreviation,
    getAbbreviation,
    saveAbbreviations,
  };
};
