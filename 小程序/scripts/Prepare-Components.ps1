param([string]$Project = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Push-Location $Project
try {
    # The published TDesign distribution includes its own npm dependencies.
    # Local-only preparation needs no AppID or platform connection.
    node --input-type=module -e '
        import fs from "node:fs";
        import path from "node:path";
        import ts from "typescript";
        const source="node_modules/tdesign-miniprogram/miniprogram_dist";
        const target="miniprogram/miniprogram_npm/tdesign-miniprogram";
        if(!fs.existsSync(source))throw Error("Run npm ci first");
        fs.mkdirSync(target,{recursive:true});
        function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
        for(const file of walk(source)){
            if(file.endsWith(".d.ts"))continue;
            const relative=path.relative(source,file),destination=path.join(target,relative);
            fs.mkdirSync(path.dirname(destination),{recursive:true});
            if(!file.endsWith(".js")||relative.startsWith("miniprogram_npm")){fs.copyFileSync(file,destination);continue;}
            let text=fs.readFileSync(file,"utf8");
            text=ts.transpileModule(text,{compilerOptions:{allowJs:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018,esModuleInterop:true}}).outputText;
            text=text.replace(/require\("([^".][^"]*)"\)/g,(all,id)=>{
                const located=path.join(target,"miniprogram_npm",id);
                const candidates=[located+".js",path.join(located,"index.js"),path.join(located,id.split("/").pop()+".js")];
                const hit=candidates.find(p=>fs.existsSync(path.join(source,path.relative(target,p))));
                if(!hit)throw Error("Unresolved vendor import "+id+" in "+file);
                let rel=path.relative(path.dirname(destination),hit).split(path.sep).join("/");if(!rel.startsWith("."))rel="./"+rel;
                return "require("+JSON.stringify(rel)+")";
            });
            fs.writeFileSync(destination,text);
        }
        const font="miniprogram/assets/demo/tdesign-icons.woff";
        if(!fs.existsSync(font))throw Error("Bundled icon font is missing");
        const stylesheet=path.join(target,"icon/icon.wxss");
        const face="@font-face{font-family:t;src:url(data:font/woff;base64,"+fs.readFileSync(font).toString("base64")+") format(\u0027woff\u0027);font-weight:400;font-style:normal;}";
        fs.writeFileSync(stylesheet,fs.readFileSync(stylesheet,"utf8").replace(/@font-face\{[^}]+\}/,face));
        console.log("Local TDesign 1.17.0 components and offline font prepared");
    '
    if ($LASTEXITCODE -ne 0) { throw 'Component preparation failed' }
} finally { Pop-Location }
