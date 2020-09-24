import {useState,useEffect} from 'react';
import {queryGraphQL} from '../lib/graphql';
import {useRouter} from 'next/router'

export function AllUsersControls(){
	const[users,setUsers]=useState([])

	const fetchData=async ()=>{
		let res=await queryGraphQL(`
			query{
				allUsers{
					id
					email
					role
					password_is_set
				}
			}


		`,{});
		
		setUsers(res.data.allUsers)
		
	}

	useEffect(()=>{
		fetchData();
	},[])


	return (<div>
		<NewUserForm fetchData={fetchData}/>
		<UserTable users={users}  fetchData={fetchData} />
	</div>);
}

function NewUserForm(props){
	const [email,setEmail] =useState('');
	const [passwordA,setPasswordA] =useState('');
	const [passwordB,setPasswordB] =useState('');
	const [role,setRole]=useState('');
	const [validationErrors,setValidationErrors]=useState([]);

	const addUser=async ()=>{
		let errors=[];
		if(passwordA!==passwordB){
			errors.push('passwords must match');
		}
		if(passwordA.length<8){
			errors.push('password must be atleat 8 characters');
		}
		if(errors.length===0){
			await queryGraphQL(`
				mutation ($email:String!, $pass :String!, $role:UserRoleType!){
					createUser(data:{
						password:$pass,
						email:$email,
						role:$role
					}){
						id
					}
				}
			
			`,{
				email:email,
				pass:passwordA,
				role:role
			});
		}

		props.fetchData();
			
		
		
		setValidationErrors(errors);
	
	}


	return(<div>
		Add User<br/>
		email<input type="text" value={email} onChange={(ev)=>{setEmail(ev.target.value)}}/><br/>
		password<input type="password" value={passwordA} onChange={(ev)=>{setPasswordA(ev.target.value)}}/><br/>
		retype password<input type="password" value={passwordB} onChange={(ev)=>{setPasswordB(ev.target.value)}}/><br/>
		role <select value={role} onChange={(ev)=>{setRole(ev.target.value)}}>
			<option value="">Select Users Role</option>
			<option value="none">None</option>
			<option value="volunteer">Volunteer</option>
			<option value="admin">Admin</option>
		</select><br/>
		{validationErrors.length>0&&(<>
			<ul>
				{validationErrors.map((el)=>{
					return <li key={el}>{el}</li>
				})}
			</ul>
		</>)}
		<button onClick={addUser}>Add User</button>
	</div>)
}


function UserTable(props){


	return (<table>
		<thead>
			<tr>
				<th>email</th>
				<th>role</th>
				<th>Password</th>
				<th>Edit</th>
			</tr>
		</thead>
		<tbody>
			{props.users.map((el)=>{
				return (<tr key={el.id}>
					<td>{el.email}</td>
					<td>{el.role}</td>
					<td>{el.password_is_set?'***':'Error password is missing'}</td>
					<td><a href={'/edit/user?user='+encodeURIComponent(el.id)}>Edit</a></td>
				</tr>)
			})}
		</tbody>
	</table>)
}



export function UserEditForm(){
	const[user,setUser]=useState(null);
	const [email,setEmail]=useState('');
	const [passwordA,setPasswordA]=useState('');
	const [passwordB,setPasswordB]=useState('');
	const [role,setRole]=useState('');

	const router=useRouter();
	let userID=router.query.user!==undefined?router.query.user:''
	
	const fetchData=async ()=>{
		let res=await queryGraphQL(`
			query($userID:ID!){
				User(where:{id:$userID}){
					id
					email
					role
					password_is_set
				}
			}


		`,{
			userID:userID
		});

		console.log(res.data.User)
		if(res.data.User!==null){
				if(email===''){
					setEmail(res.data.User.email)
				} 
				if(role===''){
					setRole(res.data.User.role)
				}
		}
		setUser(res.data.User);
		
	}

	const updateEmail=async ()=>{
		await queryGraphQL(`
			mutation ($userID:ID!,$newEmail:String!){
				updateUser(id:$userID,data:{
					email:$newEmail
				}){
					id
				}
			}
		`,{
			userID:userID,
			newEmail:email
		});
		fetchData();
	}


	const updatePassword=async ()=>{
		await queryGraphQL(`
			mutation ($userID:ID!,$password:String!){
				updateUser(id:$userID,data:{
					password:$password
				}){
					id
				}
			}
		`,{
			userID:userID,
			password:passwordA
		});
		fetchData();
		setPasswordA('');
		setPasswordB('');
	}

	const updateRole=async ()=>{
		await queryGraphQL(`
			mutation ($userID:ID!,$role:UserRoleType!){
				updateUser(id:$userID,data:{
					role:$role
				}){
					id
				}
			}
		`,{
			userID:userID,
			role:role
		});
		fetchData();
	}

	useEffect(()=>{
		let getInitialData=async()=>{
			await fetchData();
			console.log(user);
		

		}
		getInitialData();
		
		
	},[userID]);

	let passwordErrors=[];

	if(passwordA!==passwordB){
		passwordErrors.push(['passwords Must Match']);
	}
	if(passwordA.length<8&&passwordA.length>0){
		passwordErrors.push(['password Must be at least 8 characters']);
	}

	return(<div>
		{user!==null&&(<>
			<h1>{user.email}</h1>
			email:<input value={email} onChange={(ev)=>{setEmail(ev.target.value)}}/>
			{email!==user.email&&(<button onClick={updateEmail}>Save Email Change</button>)}
			<br/>
			New Password<input value={passwordA} onChange={(ev)=>{setPasswordA(ev.target.value)}}/><br/>
			Retype New Password<input value={passwordB} onChange={(ev)=>{setPasswordB(ev.target.value)}}/>
			{passwordErrors.length>0&&(<ul>
				{passwordErrors.map((el)=>{
					return <li key={el}>{el}</li>
				})}
			</ul>)}
			{passwordErrors.length===0&&passwordA!==''&&(<><br/><button onClick={updatePassword}>Change Password</button></>)}
			<br/>

			role:<select value={role} onChange={(ev)=>{setRole(ev.target.value)}} >
				<option value="none">none</option>
				<option value="volunteer">volunteer</option>
				<option value="admin">admin</option>
			</select>
			{role!==user.role&&(<button onClick={updateRole}>Change Role</button>)}
		</>)}
		{user===null&&(<>
		User not found
		
		</>)}
	</div>)
}