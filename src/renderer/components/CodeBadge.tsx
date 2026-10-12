import type { Code } from '../../shared/types';

export const CodeBadge = ({ code }: { code: Code }) => <span className={`code ${code}`}>{code}</span>;
