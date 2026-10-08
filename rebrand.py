import os
import re
from pathlib import Path

def replace_in_file(filepath, old_texts, new_text, exact_match=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = content
    for old_text in old_texts:
        if exact_match:
            modified = modified.replace(old_text, new_text)
        else:
            pattern = re.compile(re.escape(old_text), re.IGNORECASE)
            modified = pattern.sub(new_text, modified)
            
    if modified != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(modified)
        print(f"Updated {filepath}")

def do_renames():
    for root, dirs, files in os.walk('frontend'):
        if 'node_modules' in root or '.git' in root or 'dist' in root or '.pytest_cache' in root:
            continue
        for file in files:
            if file.endswith(('.ts', '.tsx', '.html', '.md')):
                filepath = os.path.join(root, file)
                if file == 'Sidebar.tsx': continue
                
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                modified = content.replace("Mobileum Renewals Intelligence", "Mobileum Horizon")
                modified = modified.replace("Renewals Intelligence", "Mobileum Horizon")
                
                if modified != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(modified)
                        print(f"Renamed in {filepath}")

    for root, dirs, files in os.walk('backend'):
        if '.pytest_cache' in root or '__pycache__' in root:
            continue
        for file in files:
            if file.endswith(('.py', '.md')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                modified = content.replace("Mobileum Renewals Intelligence", "Mobileum Horizon")
                modified = modified.replace("Renewals Intelligence", "Mobileum Horizon")
                
                if modified != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(modified)
                        print(f"Renamed in {filepath}")
    
    # Also README.md and PROGRESS.md
    for file in ['README.md', 'PROGRESS.md']:
        if os.path.exists(file):
            with open(file, 'r', encoding='utf-8') as f:
                content = f.read()
            modified = content.replace("Mobileum Renewals Intelligence", "Mobileum Horizon")
            modified = modified.replace("Renewals Intelligence", "Mobileum Horizon")
            if modified != content:
                with open(file, 'w', encoding='utf-8') as f:
                    f.write(modified)
                    print(f"Renamed in {file}")

def update_sidebar():
    filepath = 'frontend/src/components/layout/Sidebar.tsx'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    old_brand = '''            <p className="text-white font-extrabold text-sm leading-tight tracking-wide font-display">
              Mobileum
            </p>
            <p className="text-teal-400 text-[11px] font-medium tracking-tight">
              Renewals Intelligence
            </p>'''
    new_brand = '''            <p className="text-white font-extrabold text-sm leading-tight tracking-wide font-display">
              Mobileum Horizon
            </p>
            <p className="text-teal-400 text-[10px] font-medium tracking-tight opacity-90">
              Renewals Intelligence Platform
            </p>'''
    content = content.replace(old_brand, new_brand)
    
    if "Clock" not in content:
        content = content.replace("LayoutDashboard,", "LayoutDashboard,\n  Clock,")
    
    content = content.replace("{ to: '/opportunities', icon: Table2, label: 'Explore' }", "{ to: '/opportunities', icon: Table2, label: 'Data Explorer' }")
    
    if "/delayed" not in content:
        content = content.replace("{ to: '/regions', icon: Globe2, label: 'Regions' },", "{ to: '/regions', icon: Globe2, label: 'Regions' },\n  { to: '/delayed', icon: Clock, label: 'Delayed Renewals' },")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        print("Updated Sidebar.tsx")

def update_app():
    filepath = 'frontend/src/App.tsx'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "import Delayed" not in content:
        content = content.replace("import Regions from '@/pages/Regions'", "import Regions from '@/pages/Regions'\nimport Delayed from '@/pages/Delayed'")
        content = content.replace('<Route path="/regions" element={<Regions />} />', '<Route path="/regions" element={<Regions />} />\n          <Route path="/delayed" element={<Delayed />} />')
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        print("Updated App.tsx")

def update_command_palette():
    filepath = 'frontend/src/components/layout/CommandPalette.tsx'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = re.sub(r"id: 'expiry', name: 'Expiry Overview', path: '/pipeline'", "id: 'expiry', name: 'Expiry Overview', path: '/expiry'", content)
    content = re.sub(r"id: 'approvals', name: 'Approvals Status', path: '/pipeline'", "id: 'approvals', name: 'Approvals Status', path: '/approvals'", content)
    content = re.sub(r"id: 'bu', name: 'Business Units', path: '/pipeline'", "id: 'bu', name: 'Business Units', path: '/business-units'", content)
    content = re.sub(r"id: 'regions', name: 'Regions', path: '/pipeline'", "id: 'regions', name: 'Regions', path: '/regions'", content)
    content = re.sub(r"name: 'Explore Opportunities'", "name: 'Data Explorer'", content)
    
    if "id: 'delayed'" not in content:
        delayed_item = "      { id: 'delayed', name: 'Delayed Renewals', path: '/delayed', section: 'Views', icon: <Clock className=\"w-4 h-4\" /> },"
        content = re.sub(r"({ id: 'regions', [^\}]+},)", r"\1\n" + delayed_item, content)
        if "Clock," not in content:
            content = content.replace("LayoutDashboard,", "LayoutDashboard, Clock,")
            
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        print("Updated CommandPalette.tsx")

def update_footer():
    filepath = 'frontend/src/components/layout/Shell.tsx'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "Mobileum Horizon" not in content:
        if "useAppStore" not in content:
            content = content.replace("import { Outlet } from 'react-router-dom'", "import { Outlet } from 'react-router-dom'\nimport { useAppStore } from '@/store/appStore'")
            
        if "activeSnapshot =" not in content:
            content = re.sub(r"export default function Shell\(\) {\n", "export default function Shell() {\n  const activeSnapshot = useAppStore(s => s.activeSnapshot)\n  const asOf = activeSnapshot?.snapshot_date ? new Date(activeSnapshot.snapshot_date).toLocaleDateString() : 'N/A'\n", content)
            
        footer_jsx = '''          <footer className="mt-8 text-center text-xs text-slate-400 font-medium py-4">
            Mobileum Horizon · Renewals Intelligence Platform · Data as of {asOf}
          </footer>'''
        
        content = content.replace("</main>", f"{footer_jsx}\n        </main>")
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        print("Updated Shell.tsx")

do_renames()
update_sidebar()
update_app()
update_command_palette()
update_footer()
