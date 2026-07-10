import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
    mainSidebar: [
        'index',
        {
            type: 'category',
            label: 'Getting Started',
            collapsed: false,
            items: [
                'getting-started/installation',
                'getting-started/quick-start',
                'getting-started/connecting-designer'
            ]
        },
        {
            type: 'category',
            label: 'Core Features',
            items: [
                'features/project-browser',
                'features/resources',
                'features/embedded-scripts',
                'features/search',
                'features/git-merge-conflicts'
            ]
        },
        {
            type: 'category',
            label: 'Language Intelligence',
            items: ['language/overview', 'language/gateway-lsp', 'language/completion', 'language/ignition-stubs']
        },
        {
            type: 'category',
            label: 'Debugging & Console',
            items: ['debugging/script-console', 'debugging/debugger', 'debugging/limitations']
        },
        {
            type: 'category',
            label: 'Live Designer Tools',
            items: ['live-tools/tag-browser', 'live-tools/perspective-profiling', 'live-tools/designer-navigation']
        },
        {
            type: 'category',
            label: 'Designer Bridge Module',
            items: [
                'module/overview',
                'module/installation',
                'module/security',
                'module/headless-api',
                'module/json-rpc-reference'
            ]
        },
        {
            type: 'category',
            label: 'Reference',
            items: ['reference/configuration', 'reference/settings', 'reference/commands', 'reference/external-tools']
        },
        'troubleshooting',
        'development'
    ]
};

export default sidebars;
