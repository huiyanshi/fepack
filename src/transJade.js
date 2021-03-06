let path = require('path')
let fs = require('fs')
let exec = require('child_process').exec
let colors = require('colors')
let deepAssign = require('deep-assign')
let util = require('./util')
var jade = require('jade')

let g_conf = global.g_conf
let tmpDir = g_conf.tmpDir
let releaseConf = g_conf.fepackJSON.release

let isWatch = g_conf.case.watch

//* 依赖表
let depTable = {}
let reg = /(?:include|extends)\s+(.*?)\s*$/gm

function insertDepTable(childF, mainF){
    if (! (childF in depTable)){
        depTable[childF] = [mainF]
    }
    else {
        if (depTable[childF].indexOf(mainF) == -1){
            depTable[childF].push(mainF)
        }
    }
}

function scanF(f){
    if (!fs.existsSync(f)){
        return
    }

    let body = util.getBody(f)

    let dfs = [], v
    while ( null != (v = reg.exec(body)) ){
        let df = path.join(path.dirname(f), v[1])
        if (path.extname(df) == ''){
            df = `${df}.jade`
        }

        insertDepTable(path.relative(tmpDir.a, df), f)
        dfs.push(df)
    }

    dfs.forEach(_=>{
        scanF(_)
    })
}

function isJade(f){
    return path.extname(f) == '.jade'
}

function transJade(f){
    if (!fs.existsSync(f) || !isJade(f)){
        return
    }

    let body = ''

    try{
        body = jade.compileFile(f, {pretty:true, doctype:'html'})({FEDOG:g_conf.case.env, FEPACK:g_conf.case.env})
    }
    catch(ex){
        util.error(ex)
    }

    let rf = path.relative(tmpDir.a, f)
    let f2

    util.log(`[translate]: ${rf}`)

    // 用jade来写(tpl|vm|..)文件的方式
    if (/\.\w+?\.jade$/.test(rf)){
        f2 = path.join(tmpDir.b, rf.slice(0, -5))
    }
    else {
        f2 = path.join(tmpDir.b, rf.slice(0, -5) + '.html')
    }

    util.createF(f2, body)
    scanF(f)
}

function translate(){
    util.walk(tmpDir.a, f => {
        transJade(f)
    })
}

function watch(){
    util.watch(tmpDir.a, (e, rf)=>{
        if (!isJade(rf)){
            return false
        }

        let f = path.join(tmpDir.a, rf)

        // 不再检测下划线开头的私有文件，因为可能在编译的下阶段被js引用
        if (rf in depTable){
            depTable[rf].forEach(_=>{
                transJade(_)
            })
        }
        transJade(f)
    })
}

exports.translate = translate
exports.watch = watch
