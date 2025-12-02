import React from 'react';

interface PageLayoutProps {
    children: React.ReactNode;
    showGrid?: boolean;
    glowColor?: 'cyan' | 'magenta' | 'lime' | 'none';
    className?: string;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
    children,
    showGrid = true,
    glowColor = 'cyan',
    className = ''
}) => {
    return (
        <main className={`min-h-screen bg-background-primary relative overflow-hidden selection:bg-accent-cyan/20 selection:text-accent-cyan ${className}`}>
            {/* Background Grid Pattern */}
            {showGrid && (
                <div
                    className="fixed inset-0 z-0 pointer-events-none opacity-20"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
                        backgroundSize: '4rem 4rem'
                    }}
                />
            )}

            {/* Ambient Glows */}
            {glowColor !== 'none' && (
                <>
                    <div className={`fixed top-0 left-0 w-[500px] h-[500px] bg-accent-${glowColor}/5 blur-[100px] rounded-full pointer-events-none z-0`} />
                    <div className={`fixed bottom-0 right-0 w-[500px] h-[500px] bg-accent-${glowColor === 'cyan' ? 'magenta' : 'cyan'}/5 blur-[100px] rounded-full pointer-events-none z-0`} />
                </>
            )}

            <div className="relative z-10">
                {children}
            </div>
        </main>
    );
};
