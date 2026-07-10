import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import remarkCodeImport from 'remark-code-import';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
    title: 'Flint',
    tagline: 'Develop Ignition projects in VS Code — real editing, IntelliSense, debugging, and live Designer tools',
    favicon: 'img/flint-icon.png',

    // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
    // NOTE: v4 flag disabled — its SSG worker threads break theme-mermaid's
    // useColorMode during static rendering (Hook called outside ColorModeProvider).
    future: {
        v4: {
            removeLegacyPostBuildHeadAttribute: true,
            useCssCascadeLayers: true
        }
    },

    // Set the production url of your site here
    url: 'https://flint.docs.bwdesigngroup.dev',
    // Set the /<baseUrl>/ pathname under which your site is served
    baseUrl: '/',

    organizationName: 'bw-design-group',
    projectName: 'flint-vscode-extension',

    onBrokenLinks: 'warn',

    markdown: {
        mermaid: true
    },

    themes: ['@docusaurus/theme-mermaid'],

    i18n: {
        defaultLocale: 'en',
        locales: ['en']
    },

    plugins: [
        [
            '@easyops-cn/docusaurus-search-local',
            {
                indexDocs: true, // Index documentation pages
                indexBlog: false, // Blog is disabled in presets
                indexPages: false, // Skip indexing static pages
                language: 'en', // Match your i18n locale
                hashed: true, // Optimize index deduplication
                docsRouteBasePath: '/' // Matches your docs routeBasePath
            }
        ]
    ],

    presets: [
        [
            'classic',
            {
                docs: {
                    sidebarPath: './sidebars.ts',
                    routeBasePath: '/',
                    remarkPlugins: [remarkCodeImport],
                    editUrl: 'https://github.com/bw-design-group/flint-vscode-extension/tree/main/docs/'
                },
                blog: false,
                theme: {
                    customCss: './src/css/custom.css'
                }
            } satisfies Preset.Options
        ]
    ],

    themeConfig: {
        // Social card image
        image: 'img/flint-social-card.png',
        colorMode: {
            respectPrefersColorScheme: true
        },
        // BW Design Group Mermaid theme (mirrors the brand PDF/deck templates)
        mermaid: {
            options: {
                themeVariables: {
                    primaryColor: '#F7F3EC',
                    primaryBorderColor: '#F15B40',
                    primaryTextColor: '#27455C',
                    lineColor: '#27455C',
                    clusterBorder: '#F15B40',
                    titleColor: '#F15B40'
                }
            }
        },
        navbar: {
            title: 'Flint',
            logo: {
                alt: 'Flint Logo',
                src: 'img/flint-icon.png',
                srcDark: 'img/flint-icon.png'
            },
            items: [
                {
                    type: 'docSidebar',
                    sidebarId: 'mainSidebar',
                    position: 'left',
                    label: 'Docs'
                },
                {
                    href: 'https://marketplace.visualstudio.com/items?itemName=Keith-gamble.ignition-flint',
                    label: 'Marketplace',
                    position: 'right'
                },
                {
                    href: 'https://github.com/bw-design-group/flint-vscode-extension',
                    label: 'GitHub',
                    position: 'right'
                },
                { type: 'search', position: 'right' }
            ]
        },
        footer: {
            style: 'dark',
            links: [
                {
                    title: 'Docs',
                    items: [
                        {
                            label: 'Getting Started',
                            to: '/getting-started/installation'
                        },
                        {
                            label: 'Configuration Reference',
                            to: '/reference/configuration'
                        },
                        {
                            label: 'Troubleshooting',
                            to: '/troubleshooting'
                        }
                    ]
                },
                {
                    title: 'Components',
                    items: [
                        {
                            label: 'VS Code Extension',
                            href: 'https://github.com/bw-design-group/flint-vscode-extension'
                        },
                        {
                            label: 'Designer Bridge Module',
                            href: 'https://github.com/bw-design-group/flint-designer-bridge-ignition-module'
                        },
                        {
                            label: 'Marketplace Listing',
                            href: 'https://marketplace.visualstudio.com/items?itemName=Keith-gamble.ignition-flint'
                        }
                    ]
                },
                {
                    title: 'Community',
                    items: [
                        {
                            label: 'Issues',
                            href: 'https://github.com/bw-design-group/flint-vscode-extension/issues'
                        },
                        {
                            label: 'BW Design Group',
                            href: 'https://www.bwdesigngroup.com'
                        }
                    ]
                }
            ],
            copyright: `Copyright © ${new Date().getFullYear()} BW Design Group. Released under the MIT License.`
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
            additionalLanguages: ['bash', 'json', 'python', 'sql', 'yaml', 'typescript', 'java']
        },
        docs: {
            sidebar: {
                hideable: true,
                autoCollapseCategories: true
            }
        }
    } satisfies Preset.ThemeConfig
};

export default config;
