import {useState,useEffect} from 'react';
import {queryGraphQL} from '../lib/graphql';
import {useRouter} from 'next/router'
import {vanUrlID} from '../lib/van';
export function ExportAnswers(){


	const [script,setScript]=useState(null);
	const [showCompleted,setShowCompleted]=useState(true);
	const router=useRouter();

	let scriptID=router.query.script!==undefined?router.query.script:''
	const fetchData=async ()=>{
		let res=await queryGraphQL(`
			query($sid:ID!){
				Script(where:{id:$sid}){
					id
					name
					questions{
						id
						questionText
						headerName
					}
					contacts{
						id
						name
						vanid
						phone
						completed
						doNotContact
						answers{
							id
							answerText
							question{
								id
							}
						}
					}
				}
			}


		`,{
			sid:scriptID
		});
		
		setScript(res.data.Script)
		
	}

	useEffect(()=>{
		if(scriptID!==''){
			fetchData();
		}
	},[scriptID])


	return (
		
		<div>
			{script!==null&&(
				<>
				<div>Script: {script.name}</div>
				<ContactSelectionOptions showCompleted={showCompleted} setShowCompleted={setShowCompleted}/>
				<DownloadCSVLink showCompleted={showCompleted} script={script}/>
				<AnswerTable showCompleted={showCompleted} script={script}/>
				</>
			)}
		
	</div>);
}

function ContactSelectionOptions(props){
	return(<div>
		Show / Export only completed<input type="checkbox" checked={props.showCompleted} onChange={()=>{props.setShowCompleted(!props.showCompleted)}}/>
	</div>);
}


function DownloadCSVLink(props){


	const makeCSV=()=>{
		let userheaders=['vanid','name','doNotContact','phone','completed','vanurl']
		let questionHeaders=props.script.questions.map((q)=>{
			return q.headerName;
		});

		let fieldRows=props.script.contacts.filter((c)=>{
			
				return  ( (props.showCompleted&&c.completed) || !props.showCompleted);
			

		}).map((c)=>{
			let vanurl='';
			if(!Number.isNaN(parseInt(c.vanid,10))){
				vanurl='https://www.votebuilder.com/ContactsDetails.aspx?VANID=EID'+vanUrlID( parseInt(c.vanid,10))
			}

			let cells=[c.vanid,c.name,c.doNotContact?'true':'false',c.phone,c.completed?'completed':'incomplete',vanurl]
			for(let q of props.script.questions){
				let ca=c.answers.filter((a)=>{
					return a.question.id===q.id;
				});
				if(ca.length!==0){
					cells.push(ca.map((a)=>{
						return a.answerText;	
					}).join('; '));
				}
				else{
					cells.push('')
				}

			}
			return cells;
		});
		let table=[userheaders.concat(questionHeaders)]
		if(fieldRows.length!==0){
			table=table.concat(fieldRows);
		}
		console.log(table);

		let csv=table.map((row)=>{
			return row.map((cell)=>{
				let cellSafe="";
				//avoid injection attack
				let cellIsNotSafe=cell.startsWith('=')||cell.startsWith('+')||cell.startsWith('-')||cell.startsWith('@');
				if(cellIsNotSafe){
					cellSafe=' '+cell;
				}
				else{
					cellSafe=cell;
				}
				return '"'+cellSafe.replaceAll('"','""')+'"'
			}).join(',')
		}).join('\r\n');
		console.log(csv);
		let fname=props.script.name+'-export-results'+'.csv'
		let file=new File([csv],fname,{
			type:'text/csv'
		})
		//console.log(file);
		return file;

	}
	let csvfile=makeCSV();


	return <a download={csvfile.name} href={URL.createObjectURL(csvfile)} >Download CSV</a>
}



function AnswerTable(props){

	// let headers=props.script.questions.map((el)=>{
	// 	return {
	// 		id:el.id,
	// 		headerName:el.headerName
	// 	}
	// })

	return (<table>
		<thead>
			<tr>
				<td>vanid</td>
				<td>name</td>
				<td>Do not Contact</td>
				<td>Phone</td>
				<td>Completed</td>
				{props.script.questions.map((el)=>{
					return <td key={el.id}> {el.headerName}</td>;
				})}
				<td>View</td>
			</tr>
		</thead>
		<tbody>
			{props.script.contacts.filter((c)=>{
				return ( (props.showCompleted&&c.completed) || !props.showCompleted);
			}).map((el)=>{
				return <AnswerRow key={el.id} script={props.script} contact={el}/>
			})}
		</tbody>
	</table>)
}




function AnswerRow(props){
	return (<tr>
		<td>{props.contact.vanid}</td>
		<td>{props.contact.name}</td>
		<td>{props.contact.doNotContact?'true':'false'}</td>
		<td>{props.contact.phone}</td>
		<td>{props.contact.completed?'completed':'incomplete'}</td>
		{props.script.questions.map((q)=>{
			return (<td key={q.id}>
				{props.contact.answers.filter((el)=>{
					return el.question.id===q.id
				}).map((a)=>{
					return a.answerText
				}).join(',')}
			</td>);
		})}
		<td>
			<a href={'/chat?script='+encodeURIComponent(props.script.id)+'&contact='+encodeURIComponent(props.contact.id)}>
				Chat
			</a> 
			{ !Number.isNaN(parseInt(props.contact.vanid,10))&&(
 				<>  <a target="_blank" rel="noreferrer" href={'https://www.votebuilder.com/ContactsDetails.aspx?VANID=EID'+vanUrlID( parseInt(props.contact.vanid,10))}>Votebuilder</a></>
			)}
			
		</td>
	</tr>);
}

