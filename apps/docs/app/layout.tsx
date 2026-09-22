import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
	title: '@webinvolve/vane — the navbar that shows what you\'re reading',
	description:
		'A scroll-aware React navbar that names the section you\'re currently reading, never breaks keyboard focus, and publishes its own height.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
