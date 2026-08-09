import os
import re

frontend_src = os.path.join("frontend", "src")

# We want to replace alert( with toast.error( if it's in a catch block or error-like, but for now we'll just replace with toast( or toast.error(.
# But looking at the grep output, almost all are errors. A few are success messages (e.g. lert(\Owner password reset for ...\)).
# We can just replace lert( with 	oast.error(. Wait, let's use a function that distinguishes based on the string.
# Or simpler: we do a regex replace lert( to 	oast.error( for all, then manually fix the 2 success ones?
# Even simpler, let's just replace lert( with 	oast( for all of them and we can style them differently or just use 	oast.error( by default.
# The user said "professional window", 	oast works nicely. Let's just use 	oast.error( if it contains 'failed', 'could not', or is in a catch block. Otherwise 	oast.success(.
# Actually, I'll just use 	oast.error( if it starts with 'alert(e?.message', and 	oast.success otherwise.

for root, dirs, files in os.walk(frontend_src):
    for f in files:
        if not f.endswith(".ts") and not f.endswith(".tsx"):
            continue
            
        path = os.path.join(root, f)
        with open(path, "r", encoding="utf-8") as file:
            content = file.read()
            
        if "alert(" not in content:
            continue
            
        # Add import if missing
        if "react-hot-toast" not in content:
            # add import toast from "react-hot-toast"; after the last import
            last_import = content.rfind("import ")
            if last_import != -1:
                end_of_line = content.find("\n", last_import)
                content = content[:end_of_line+1] + "import toast from \"react-hot-toast\";\n" + content[end_of_line+1:]
            else:
                content = "import toast from \"react-hot-toast\";\n" + content
        
        # Replace alerts
        # "alert(Owner password reset" -> toast.success
        # "alert(Shop" -> toast.success
        # "alert("Pick a shop" -> toast.error
        
        content = re.sub(r'alert\(Owner', r'toast.success(Owner', content)
        content = re.sub(r'alert\(Shop', r'toast.success(Shop', content)
        content = re.sub(r'alert\(', r'toast.error(', content)
        
        with open(path, "w", encoding="utf-8") as file:
            file.write(content)
            
print("Done replacing alerts")
