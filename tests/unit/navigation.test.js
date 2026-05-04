const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadNavigationWithDocument(document) {
    const context = {
        console,
        setTimeout,
        window: {
            GearTech: {
                Scraper: {
                    findCaseRows: () => document.rows || []
                },
                location: { href: 'https://dashboard.sapph.xyz/1354854696874938590/moderation/cases' }
            }
        },
        document
    };
    context.window.location = context.window.GearTech.location;
    vm.createContext(context);
    const source = fs.readFileSync(path.join(__dirname, '../../src/content/navigation.js'), 'utf8');
    vm.runInContext(source, context);
    return context.window.GearTech.Navigation;
}

describe('Sapphire navigation parser', () => {
    test('separates total cases from total pages', () => {
        const numberInput = {
            value: '4',
            closest: () => ({
                parentElement: { innerText: 'Showing 25 cases of 79\nBack\n4 of 4\nNext' }
            }),
            parentElement: { innerText: '4 of 4' }
        };
        const document = {
            body: { innerText: 'Found 79 cases in 0.031 seconds.\nShowing 25 cases of 79' },
            rows: Array.from({ length: 25 }, (_, index) => ({
                classList: { contains: () => false },
                innerText: `case${index} MUTE reason 01.05.2026`
            })),
            querySelectorAll: (selector) => (selector === 'input[type="number"]' ? [numberInput] : []),
            querySelector: () => null
        };

        const navigation = loadNavigationWithDocument(document);
        const info = navigation.getPaginationInfo();

        expect(info.totalCases).toBe(79);
        expect(info.totalPages).toBe(4);
        expect(info.visibleRows).toBe(25);
        expect(navigation.getTotalPages()).toBe(4);
    });
});
