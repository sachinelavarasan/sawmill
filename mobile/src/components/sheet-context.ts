import { createContext, useContext } from 'react';

/** True inside a bottom sheet: inputs there must use the sheet's own TextInput so the sheet moves above the keyboard. */
export const InSheet = createContext(false);
export const useInSheet = () => useContext(InSheet);
