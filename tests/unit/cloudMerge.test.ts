// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { mergeCloudRow } from '../../src/domain/cloudMerge'
import { remoteTask, remoteList, T1 } from '../support/factories'

describe('Cloud-Abgleich mit bekannter Basis', () => {
  it('läuft unabhängig vom Browser und führt disjunkte Felder zusammen', () => {
    expect(typeof window).toBe('undefined')
    const base=remoteTask()
    const merged=mergeCloudRow('tasks',base,{...base,title:'Lokal'},{...base,description:'Cloud'})
    expect(merged).toMatchObject({row:{title:'Lokal',description:'Cloud'},dirty:true,fields:[]})
  })
  it('erkennt gleiche Titelkonflikte auch bei gleichen Zeitstempeln',()=>{
    const base=remoteTask()
    expect(mergeCloudRow('tasks',base,{...base,title:'Lokal'},{...base,title:'Cloud'}).fields).toEqual(['title'])
  })
  it('gleiche parallele Eingaben benötigen keine Entscheidung',()=>{
    const base=remoteTask(); const same={...base,title:'Gleich'}
    expect(mergeCloudRow('tasks',base,same,same)).toMatchObject({dirty:false,fields:[]})
  })
  it('verbindet Fälligkeit, Erinnerungen, Serie und Abschluss zu einer Gruppe',()=>{
    const base=remoteTask()
    expect(mergeCloudRow('tasks',base,{...base,completed:true,completed_at:T1},{...base,due_at:T1}).fields).toContain('due_at')
  })
  it('verbindet Listenzugehörigkeit, Bereich und Reihenfolge',()=>{
    const base=remoteTask()
    expect(mergeCloudRow('tasks',base,{...base,list_id:'andere'},{...base,position:3}).fields).toContain('position')
  })
  it('fragt beim Löschen einer inzwischen bearbeiteten Aufgabe nach',()=>{
    const base=remoteTask()
    expect(mergeCloudRow('tasks',base,{...base,deleted_at:T1},{...base,title:'Neue Arbeit'}).fields).toContain('title')
  })
  it('übernimmt keine unbekannte Basis für alte Offline-Eingaben',()=>{
    const local=remoteTask({title:'Alt'}); const remote=remoteTask({title:'Neu'})
    expect(mergeCloudRow('tasks',undefined,local,remote)).toMatchObject({row:local,dirty:true,fields:['unknown-base']})
  })
  it('eine bewusste lokale Wahl erhält unabhängige Cloud-Felder',()=>{
    const base=remoteTask()
    expect(mergeCloudRow('tasks',base,{...base,title:'Lokal'},{...base,title:'Cloud',description:'Behalten'},true)).toMatchObject({row:{title:'Lokal',description:'Behalten'},fields:[]})
  })
  it('normalisiert alte Zeilen, leere Beschreibung und Zeitzonen gleich',()=>{
    const base=remoteTask({description:null})
    const result=mergeCloudRow('tasks',base,{...base,description:'',section_id:undefined},{...base,updated_at:'2026-01-01T11:00:00+01:00'})
    expect(result).toMatchObject({dirty:false,fields:[]})
  })
  it('Listennamen und Bereiche bleiben unabhängige Änderungen',()=>{
    const base=remoteList()
    expect(mergeCloudRow('lists',base,{...base,name:'Neu'},{...base,sections:[{id:'s',name:'Bereich'}]})).toMatchObject({row:{name:'Neu',sections:[{id:'s',name:'Bereich'}]},fields:[]})
  })
})
