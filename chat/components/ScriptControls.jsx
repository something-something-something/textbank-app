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
					},
					contacts{
						id
						name
						firstName
						middleName
						lastName
						vanid
						phone
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
		<ContactEditor fetchData={props.fetchData} script={props.script}/>
		<details>
		<summary>JSON DEBUG</summary>	
			<pre>
				{JSON.stringify(props.script,null,'\t')}
			</pre>
		</details>
		
	</div>);
}

function ScriptLineEditorList(props){

	let lines=props.script.scriptLines.filter((el)=>{return el.parent===null}).sort((a,b)=>{
		return a.order-b.order;
	}).map((el)=>{
		return <ScriptLineEditor key={el.id} script={props.script} line={el} fetchData={props.fetchData}  />
	});
	
	return (<div>Lines:
		
		{lines}

	</div>);
}
//split into diffrent components
//need not imediietly mutate data maybe save button?
function ScriptLineEditor(props){
	let id=props.line.id;
	let instructions=props.line.instructions;
	let english=props.line.en;
	let spanish=props.line.es;
	let siblings=props.script.scriptLines.filter((el)=>{
		if(el.id===props.line.id){
			return false;
		}
		if(props.line.parent===null){
			return el.parent===null;
		}
		else{
			return el.parent!==null&&el.parent.id===props.line.parent.id;
		}
	}).sort((a,b)=>{
		
		return a.order-b.order;
	})
	console.log(instructions);
	console.log(siblings.map((el)=>{ return el.order;}))
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

	const swapOrder =async (a,b)=>{
		let res=await queryGraphQL(`
			query{
				allScriptLines{
					order
				}
			}
		`,{})
		
		let nextOrder=1+res.data.allScriptLines.reduce((acc,curr)=>{
			return curr.order>acc?curr.order:acc;
		},0);
		// await queryGraphQL(`
		// 	mutation($tempOrder:Int!,$bID:ID!){
		// 		temp:updateScriptLine(id:$bID,data:{
		// 			order:$tempOrder
		// 		}){
		// 			id
		// 			order
		// 		}
		// 	}
		// `,{
		// 	tempOrder:nextOrder,
		// 	bID:b.id,
		// });

		await queryGraphQL(`
			mutation($tempOrder:Int!,$aID:ID!, $aOrder:Int!,$bID:ID!, $bOrder:Int!){
				temp:updateScriptLine(id:$bID,data:{
					order:$tempOrder
				}){
					id
					order
				}


				a:updateScriptLine(id:$aID,data:{
					order:$bOrder
				}){
					id
					order
				}

				b:updateScriptLine(id:$bID,data:{
					order:$aOrder
				}){
					id
					order
				}
			}
		`,{	
			tempOrder:nextOrder,
			aID:a.id,
			aOrder:a.order,
			bID:b.id,
			bOrder:b.order,
		});
		await props.fetchData();
	}

	return (<div style={{borderStyle:'solid',borderWidth:'0.1rem',borderColor:'black',padding:'1rem'}}>
		{props.line.parent!==null&&(<div>
			<button onClick={()=>{removeParent(id)}} >Don't indent</button>
		</div>)}
		Instructions: <input type="text" value={instructions} onChange={(ev)=>{updateLine(id,ev.target.value,english,spanish)}}/>
		<div>English:<br/><textarea value={english} onChange={(ev)=>{updateLine(id,instructions,ev.target.value,spanish)}}/></div>
		<div>Spanish:<br/><textarea value={spanish} onChange={(ev)=>{updateLine(id,instructions,english,ev.target.value)}}/></div>
		<button onClick={()=>{deleteLine(id)}}>Delete Line</button>
		{siblings.length>0&&(<div>
			Switch Position With
			<select value="" onChange={(ev)=>{
				if(ev.target.value!==''){
					swapOrder(props.line,siblings.find((el)=>{return el.id===ev.target.value}));
				}
			}}>
				<option value="">Select A Line to switch</option>
				{siblings.map((el)=>{
					return <option key={el.id} value={el.id}>{el.instructions}-{el.en}</option>
				})}
			</select>
		</div>)}
		<div style={{marginLeft:'3rem'}}>
			Children<br/>
			<button onClick={()=>{
				addChildLine(props.script.id,props.line.id)
			}}>Create Child Line</button>
			<SelectScriptLineAsChild script={props.script} line={props.line} fetchData={props.fetchData}/>
			{
				props.line.children.map((child)=>{
					return props.script.scriptLines.find((el)=>{
						return el.id===child.id;
					});
					
				}).sort((a,b)=>{
					return a.order-b.order;
				}).map((child)=>{
					return <ScriptLineEditor key={child.id} script={props.script} line={child} fetchData={props.fetchData}  />
				})
			}
		</div>
		order {props.line.order}
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
	//rename is actualy scripts not ancestor
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

function ContactEditor(props){
	const [showAddContact,setShowAddContact] =useState(false);
	const hideAddContact=()=>{
		setShowAddContact(false);
	}
	return (<div>Contacts
		<button onClick={()=>{setShowAddContact(!showAddContact)}}>New Contact</button>
		{showAddContact&&(
			<AddContactEditor script={props.script} fetchData={props.fetchData} hideAddContact={hideAddContact}/>
		)}
		<BulkAddContacts script={props.script} fetchData={props.fetchData} />
		<div>Contacts:{props.script.contacts.length}</div>
		<ContactTable script={props.script} fetchData={props.fetchData}/>

	</div>);
}

function BulkAddContacts(props){
	const [contactText,setContactText]=useState('');
	const [contactUploading,setContactUploading]=useState(false);
	let generateContactsFromText=(text)=>{
		let lines=text.trim().split('\n');
		let vanidPos=0;
		let namePos=0;
		let cellPos=0;
		let headers=lines[0].split('\t');
		console.log(headers)
		vanidPos=headers.findIndex((el)=>{return el.trim().startsWith('Voter File VANID')});
		cellPos=headers.findIndex((el)=>{return el.trim().startsWith('Cell Phone')});
		namePos=headers.findIndex((el)=>{return el.trim().startsWith('Name')});

		console.log('positions');


		console.log(vanidPos);
		console.log(namePos);
		console.log(cellPos);
		if(lines.length>1){
			return lines.slice(1).map((el)=>{
				let fields=el.split('\t');
				let phone='';
				let vanid='';
				let fn='';
				let mn='';
				let ln=''
				if(namePos!==-1&&fields.length>namePos){
					let name=fields[namePos].split(',');
					ln=name[0];
					if(name.length>1){
						let firstAndMiddle=name[1].trim().split(' ');
						fn=firstAndMiddle[0];
						if(firstAndMiddle.length>1){
							mn=firstAndMiddle[1]
						}
					}
				}
				if(vanidPos!==-1&&fields.length>vanidPos){
					vanid=fields[vanidPos].trim();
				}
				if(cellPos!==-1&&fields.length>cellPos){
					phone='+1'+fields[cellPos].replace(/\D/g,'');
				}
				return {
					firstName:fn,
					middleName:mn,
					lastName:ln,
					vanid:vanid,
					phone:phone
				}
			});
		}
		else{
			return[]
		}
		
		

	};
	let potentialContacts=generateContactsFromText(contactText);
	console.log(potentialContacts)
	let importContacts=async(scriptID)=>{
				// type con{
			// 	firstName:String!
			// 	middlesName:String!
			// 	lastName:String!
			// 	phone:String!
			// 	vanid:String!
			// }
		let splitContacts=[];
		for(let i=0; i<potentialContacts.length;i=i+20){
			splitContacts.push(potentialContacts.slice(i,i+20));
		}
		setContactUploading(true);
		for(let i of splitContacts){
			await queryGraphQL(`

				mutation ($scriptID:ID!,$contacts:[ContactCreateInput!]!){
					updateScript(id:$scriptID,data:{contacts:{
						create:$contacts
					}}){
						id
					}
				}
			`,{
				scriptID:props.script.id,
				contacts:i
			});
		}		
		setContactUploading(false);
		props.fetchData();
	};
	return(<div>
		Bulk Import<br/>
		<textarea value={contactText} onChange={(ev)=>{setContactText(ev.target.value)}}/>
		{contactUploading&&(<div>Uploading... </div>)}
	{potentialContacts.length>0&&(<div><button onClick={()=>{ importContacts()}}>Add {potentialContacts.length} contacts </button></div>)}
		{potentialContacts.length>0&&(<details><summary>JSON CONTACTS</summary><pre>{JSON.stringify(potentialContacts,null,'\t')}</pre></details>)}
	</div>);
}


function AddContactEditor(props){
	const [firstName,setFirstName]=useState('');
	const [middleName,setMiddleName]=useState('');
	const [lastName,setLastName]=useState('');
	const [vanID,setVanID]=useState('');
	const [phone,setPhone]=useState('');

	const addContact=async (scriptID)=>{
		await queryGraphQL(`
			mutation ($scriptID:ID!,$fn:String!,$mn:String!,$ln:String!,$phone:String!,$vanid:String!){
				updateScript(id:$scriptID,data:{contacts:{
					create:{
						firstName:$fn,
						middleName:$mn,
						lastName:$ln,
						phone:$phone,
						vanid:$vanid
					}
				}}){
					id
				}
			}
		`,{
			scriptID:scriptID,
			fn:firstName,
			mn:middleName,
			ln:lastName,
			phone:phone,
			vanid:vanID
		});
		props.hideAddContact();
		props.fetchData();
	}

	return (<div>
		First Name:<input value={firstName} onChange={(ev)=>{setFirstName(ev.target.value)}}/><br/>
		Middle Name:<input value={middleName} onChange={(ev)=>{setMiddleName(ev.target.value)}}/><br/>
		Last Name:<input value={lastName} onChange={(ev)=>{setLastName(ev.target.value)}}/><br/>
		VAN ID<input value={vanID} onChange={(ev)=>{setVanID(ev.target.value)}}/><br/>
		Phone<input value={phone} onChange={(ev)=>{setPhone(ev.target.value)}}/><br/>
		<button onClick={()=>{ addContact(props.script.id)}}>Save Contact</button>
		</div>)
}
function ContactTable(props){
	const [editRows,setEditRows]=useState([]);

	const toggleEditRows=(rowid)=>{
		if(editRows.includes(rowid)){
			setEditRows(editRows.filter((el)=>{return el!==rowid}));
		}
		else{
			setEditRows(editRows.concat([rowid]))
		}
	}

	let rows=props.script.contacts.map((el)=>{
		if(editRows.includes(el.id)){
			return <ContactTableEditRow key={el.id} contact={el} fetchData={props.fetchData} toggleEditRows={toggleEditRows}/> 
		}
		else{
			return <ContactTableViewRow key={el.id} contact={el} fetchData={props.fetchData} toggleEditRows={toggleEditRows}/>;
		}
		
	});
	let tableheadingStyle={position:'sticky',top:'0px',backgroundColor:'rgb(200,200,200)'};
	return(<table>
		<thead>
			<tr>
				<th style={tableheadingStyle}>Name</th>
				<th style={tableheadingStyle}>VanID</th>
				<th style={tableheadingStyle}>Phone</th>
				<th style={tableheadingStyle}>Controls</th>
			</tr>
		</thead>
		<tbody>
			{rows}
		</tbody>
	</table>)
}

function ContactTableViewRow(props){

	const deleteContact=async (id)=>{
		await queryGraphQL(`
			mutation ($id:ID!){
				deleteContact(id:$id){
					id
				}
			}`,
			{id:id}
		);
		props.fetchData();
	}

	return (
		<tr>
			<td>{props.contact.name} </td>
			<td>{props.contact.vanid} </td>
			<td>{props.contact.phone} </td>
			<td>
				<button onClick={()=>{props.toggleEditRows(props.contact.id)}}> Edit</button>
				<button onClick={()=>{deleteContact(props.contact.id)}}>Delete</button>
			</td>
		</tr>
	);
}

function ContactTableEditRow(props){

	// <td>{props.contact.name} </td>
	// 		<td>{props.contact.vanid} </td>
	// 		<td>{props.contact.phone} </td>
	const [firstName,setFirstName]=useState(props.contact.firstName);
	const [middleName,setMiddleName]=useState(props.contact.middleName);
	const [lastName,setLastName]=useState(props.contact.lastName);
	const [vanID,setVanID]=useState(props.contact.vanid);
	const [phone,setPhone]=useState(props.contact.phone);


	const updateContact=async ()=>{
		await queryGraphQL(`
			mutation ($id:ID!,$fn:String!,$mn:String!,$ln:String!,$phone:String!,$vanid:String!){
				updateContact(id:$id,data:{
					firstName:$fn,
					middleName:$mn,
					lastName:$ln,
					vanid:$vanid,
					phone:$phone
				}){
					id
				}
			}`,
			{
				id:props.contact.id,
				fn:firstName,
				mn:middleName,
				ln:lastName,
				vanid:vanID,
				phone:phone
			});
		props.toggleEditRows(props.contact.id);
		props.fetchData();
	}

	return(
		<tr>
			<td>
				<input value={firstName} onChange={(ev)=>{setFirstName(ev.target.value)}}/> 
				<input value={middleName} onChange={(ev)=>{setMiddleName(ev.target.value)}}/> 
				<input value={lastName} onChange={(ev)=>{setLastName(ev.target.value)}}/> 
			</td>
			<td>
				<input value={vanID} onChange={(ev)=>{setVanID(ev.target.value)}}/> 
			</td>
			<td>
				<input value={phone} onChange={(ev)=>{setPhone(ev.target.value)}}/> 
			</td>
			<td>
				<button onClick={()=>{props.toggleEditRows(props.contact.id)}}> Don't Save</button>
				<button onClick={()=>{updateContact()}}>Save</button>
			</td>
		</tr>
	);
}