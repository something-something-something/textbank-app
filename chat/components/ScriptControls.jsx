import {useState,useEffect} from 'react';
import {queryGraphQL} from '../lib/graphql';


export function ScriptControls(props){
	const [scripts,setScripts]=useState([]);

	const fetchData=async ()=>{
		let data=await queryGraphQL(`
			query{
				allScripts{
					id,
					name,
					scriptLines{
						id,
						script{
							id
						},
						order,
						instructions,
						en,
						es,
						parent{
							id
						}
						children{
							id
						}
					}
				}
			}
		`,{});
		console.log(data);
		setScripts(data.data.allScripts);
	}


	useEffect(()=>{
		fetchData();
	},[])
	


	return (<div>
			<CreateScriptBox fetchData={fetchData}/>
			<ScriptList scripts={scripts} fetchData={fetchData}/>
		</div>)
}

function ScriptList(props){
	let scriptEntries=props.scripts.map((scr)=>{
		return (<details key={scr.id}>
			<summary>{scr.name}</summary>
			<DeleteScriptButton script={scr} fetchData={props.fetchData}/>
			<ScriptEditor script={scr} fetchData={props.fetchData}/>
			

		</details>);
	})

	return (<div>{scriptEntries}</div>);
}
function ScriptEditor(props){
	return (<div>
		{props.script.name}
		<ScriptLineEditorList script={props.script} fetchData={props.fetchData} />
		<AddScriptLineButton fetchData={props.fetchData} script={props.script}/>
		
		<pre>
			{JSON.stringify(props.script,null,'\t')}
		</pre>
		
	</div>);
}

function ScriptLineEditorList(props){

	let lines=props.script.scriptLines.filter((el)=>{return el.parent===null}).map((el)=>{
		return <ScriptLineEditor key={el.id} script={props.script} line={el} fetchData={props.fetchData}  />
	});
	
	return (<div>Lines:
		
		{lines}

	</div>);
}
//split into diffrent components
function ScriptLineEditor(props){
	let id=props.line.id;
	let instructions=props.line.instructions;
	let english=props.line.en;
	let spanish=props.line.es;

	const updateLine=async (id,instructions,english,spanish)=>{
		await queryGraphQL(`
			mutation($lineID:ID!,$instructions:String!,$english:String!,$spanish:String!){
				updateScriptLine(id:$lineID,data:{
					instructions:$instructions,
					en:$english,
					es:$spanish
				}){
					id
				}
			}
		`,{
			lineID:id,
			instructions:instructions,
			english:english,
			spanish:spanish
		});
		props.fetchData();
	}
	const deleteLine=async (id)=>{
		await queryGraphQL(`
			mutation($lineID:ID!){
				deleteScriptLine(id:$lineID){
					id
				}
			}
		`,{lineID:id});
		props.fetchData();
	}

	const addChildLine=async (scriptid,lineid)=>{
		await queryGraphQL(`
			mutation($lineID:ID!,$scriptID:ID!){
				updateScriptLine(id:$lineID,data:{
					children:{
						create:{
							script:{
								connect:{
									id: $scriptID
								}
							}
							
						}
					}
				}){
					id
				}
			}
		`,{
			lineID:lineid,
			scriptID:scriptid
		});
		props.fetchData();
	}

	const removeParent=async (id)=>{
		await queryGraphQL(`
			mutation($lineID:ID!){
				updateScriptLine(id:$lineID,data:{
					parent:{
						disconnectAll:true
					}
				}){
					id
				}
			}
		`,{
			lineID:id
		});
		props.fetchData();
	}
	return (<div style={{borderStyle:'solid',borderWidth:'0.1rem',borderColor:'black',padding:'1rem'}}>
		{props.line.parent!==null&&(<div>
			<button onClick={()=>{removeParent(id)}} >Don't indent</button>
		</div>)}
		Instructions: <input type="text" value={instructions} onChange={(ev)=>{updateLine(id,ev.target.value,english,spanish)}}/>
		<div>English:<br/><textarea value={english} onChange={(ev)=>{updateLine(id,instructions,ev.target.value,spanish)}}/></div>
		<div>Spanish:<br/><textarea value={spanish} onChange={(ev)=>{updateLine(id,instructions,english,ev.target.value)}}/></div>
		<button onClick={()=>{deleteLine(id)}}>Delete Line</button>
		<div style={{marginLeft:'3rem'}}>
			Children<br/>
			<button onClick={()=>{
				addChildLine(props.script.id,props.line.id)
			}}>Create Child Line</button>
			<SelectScriptLineAsChild script={props.script} line={props.line} fetchData={props.fetchData}/>
			{
				props.line.children.map((child)=>{
					let line=props.script.scriptLines.find((el)=>{
						return el.id===child.id;
					});
					return <ScriptLineEditor key={child.id} script={props.script} line={line} fetchData={props.fetchData}  />
				})
			}
		</div>
	</div>);
}

function SelectScriptLineAsChild(props){
	//const [childID,setChildID]=useState('');
	const adoptChild=async (parentid,childid)=>{
		await queryGraphQL(`
			mutation($parentID:ID!,$childID:ID!,){
				updateScriptLine(id:$parentID,data:{
					children:{
						connect:{
							id:$childID
						}
					}
				}){
					id
				}
			}
		`,{
			parentID:parentid,
			childID:childid
		});
		props.fetchData();
	}
	//make sure this stays a tree
	//move or have equivelent serverside
	let ancestors=(id,arr)=>{
		let obj=props.script.scriptLines.find((el)=>{return el.id===id});
		if(obj.parent!==null){
			arr=arr.concat([id,...ancestors(obj.parent.id,arr)]);
			console.log(arr);
			return arr;
		}
		else{
			return arr.concat([id]);
		}	
	}
	let scriptsWithNoParents=props.script.scriptLines.filter((el)=>{
		// if(el.parent===null){
		// 	el.id!==props.line.id;
		// } 
		// else{
		// 	return false;
		// }
		return !ancestors(props.line.id,[]).some((an)=>{ return an===el.id})&&!props.line.children.some((c)=>{return c.id===el.id});
	});
	
	
	let options=scriptsWithNoParents.map((el)=>{
		return <option key={el.id} value={el.id}>{el.instructions} - {el.en}</option>
	})
	return (<select onChange={(ev)=>{ 
		if(ev.target.value!==''){
			adoptChild(props.line.id,ev.target.value);
		}
	}} value="">
		<option value="">Select a line To add it as a Child</option>
		{options}
	</select>)
}

function AddScriptLineButton(props){
	
	const addLine=async (scriptID)=>{
		await queryGraphQL(`
			mutation ($scriptID:ID!){
				updateScript(id:$scriptID,data:{scriptLines:{
					create:{}
				}}){
					id
				}
			}
		`,{scriptID:scriptID});
		props.fetchData();
	}	
	return (<button onClick={()=>{addLine(props.script.id)}}>Add Line</button>);
}

function DeleteScriptButton(props){
	const deleteScript=async (script)=>{
		await queryGraphQL(`
			mutation ($scriptID: ID!,$lineIDs: [ID!]!){
				deleteScriptLines(ids:$lineIDs){
					id
				}
				deleteScript(id:$scriptID){
					id
				}
			}
		`,{
			scriptID:script.id,
			lineIDs:script.scriptLines.map((line)=>{return line.id})
		});
		await props.fetchData();
	}

	return <button onClick={()=>{deleteScript(props.script)}}>Delete Script</button>
}


function CreateScriptBox(props){
	const [scriptName,setScriptName]=useState('');

	const createScript=async()=>{
		await queryGraphQL(`
			mutation ($scriptName: String!){
				createScript(data:{name:$scriptName}){
					id
				}
			}
		`,{scriptName:scriptName});
		await props.fetchData();

	};

	return (<div>Name:
		<input value={scriptName} onChange={(ev)=>{setScriptName(ev.target.value)}}/>
		<button onClick={()=>{createScript()}}>New Script</button>
	
	</div>)
}