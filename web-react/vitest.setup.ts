import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock URL.createObjectURL and URL.revokeObjectURL for jsdom
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test-url');
global.URL.revokeObjectURL = vi.fn();
