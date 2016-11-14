// Anystroage Web Socket Server!

var socketio = require("socket.io");
var socketStream = require("socket.io-stream");
var mysql = require("mysql");
var hash = require('password-hash');
var HashMap = require('hashmap');
var serverStream = require('stream');
var fs = require('fs');
var port = 9900;
var io = socketio.listen(port);
var stream = socketStream.createStream();
var streamSet = new HashMap();
var clientSerial = 1;
var downloadMap = new HashMap();
var maxBufferSize = 1024*96;
io.set('heartbeat timeout', 1800000);
io.set('heartbeat interval', 8000000);
io.set("destroy buffer size", 900000000);
// io.set("destroy buffer size", maxBufferSize);
var conn = mysql.createConnection({
	host : "localhost",
	port : 3306,
	user : "root",
	password : "gksksla183",
	database : "Anystorage"
});


console.log("=========== START Anystroage WebSocket Server ===========");
console.log("Server Port : ", port);
console.log("Listen....");
io.sockets.on("connection", function(socket){
	console.log("=/ connection : ", socket.conn.remoteAddress);
	socket.emit("type", {});

	// Browser
	socket.on("browser", function(data){
		initBrowser(socket);
		socket.room = data.room;
		
		socket.join(socket.room);
		// console.log("client : ", io.sockets.in(data.room).sockets);
		io.sockets.in(socket.room).emit("req_on_device", {});
	});

	// Device
	socket.on("device", function(data){
		
		initDevice(socket);
	});
});


function initBrowser(client){
	if(client.anyType == null){
		client.anyType = "browser";
		// console.log("=/ Initialize Browser!!", client);
		console.log("=/ Initialize Browser!!");
		client.emit("state", {});
		client.on("main_state", function(){
			console.log("=/ Main Page!!");
			registeMainEvent(client);
		});
		client.on("manage_state", function(data){
			console.log("=/ Manage Page!!");
			client.device_channel = data.member+data.device;
			client.join(client.device_channel);
			client.emit("ok_manage", {});
			client.mySerial = "client_"+clientSerial;
			clientSerial++;
			// io.sockets.in(data.member).emit(data.member+data.device, data);
			registeManageEvent(client);
		});
	}
}
function registeManageEvent(client){
	client.on("connect_device", function(data){
		console.log("request connect device");

		// console.log("request_file_tree");
		// io.sockets.in(client.device_channel).emit("req_file_tree", {});
		io.sockets.in(data.member).emit(data.member+data.device, data);
	});
	client.on("request_first_file_tree", function(data){
		console.log("request_file_tree");
		io.sockets.in(client.device_channel).emit("req_file_tree", {});
	});
	client.on("request_new_forder", function(data){
		console.log("request create forder", data);
		io.sockets.in(client.device_channel).emit("mkdir", data);
	});
	client.on("request_rename", function(data){
		console.log("request rename", data);
		io.sockets.in(client.device_channel).emit("rename", data);
	});
	client.on("request_rm", function(data){
		console.log("request remove", data);
		io.sockets.in(client.device_channel).emit("req_rm", data);
	});
	client.on("request_cut_paste", function(data){
		console.log("request cut paste", data);
		io.sockets.in(client.device_channel).emit("cut_paste", data);
	});
	client.on("request_copy_paste", function(data){
		console.log("request copy paste", data);
		io.sockets.in(client.device_channel).emit("copy_paste", data);
	});
	client.on("update_file_tree", function(data){
		console.log("update_tree");
		io.sockets.in(client.device_channel).emit("update_tree", data);

	});
	// client.on("request_file", function(data){
	// 	console.log("request file Data ");
	// 	io.sockets.in(client.device_channel).emit("req_file", data);
	// });
	socketStream(client).on("request_download", function(stream, data){
		data.client_id = client.id;
		// data.clientSerial = client.mySerial;
		console.log("request download : ", data);
		streamSet.set(client.id, stream);

		// streamSet.set(client.mySerial, stream);
		io.sockets.in(client.device_channel).emit("req_file", data);
	});
	socketStream(client).on("fileUpload", function(stream, data){
		var fileName = data.fileName;
		var fileSize = data.fileSize;
		var fileDest = data.fileDest;
		var readSize = 0;
		var buffer = [];
		console.log("File Upload!");
		console.log("file : ", fileName);
		stream.on("data", function(chunk){
			readSize += chunk.length;
			buffer.push(chunk);
			console.log(Math.floor(readSize/fileSize *100)+"%");
		});
		stream.on("end", function(){
			data.buffer = [];
			
			var i = 0;
			for(var idx = 0, len = buffer.length; idx<len; idx++){
				var row = buffer[idx];
				console.log("kts : ", buffer[idx]);
				for(var j = 0, len2 = row.length; j<len2; j++){
					data.buffer[i++] = row[j];
					// console.log("idx("+idx+")("+j+") : ", row[j]);
				}
			}
			console.log("data receive end!");
			// console.log("buffer : ", data.buffer);
			io.sockets.in(client.device_channel).emit("upload", data);
		});
	});

}
function registeMainEvent(client){
	// client.on("connect_device", function(data){
	// 	console.log("request connect device");
	// 	io.sockets.in(client.room).emit(data.member+data.device, data);
	// });
	
}

function initDevice(fileServer){
	if(fileServer.anyType == null){
		fileServer.anyType = "device";
		console.log("=/ Initialize FileManager Server!!");

		fileServer.on("res_on_device", function(res){
			var userId = fileServer.room;
			var mem_no = fileServer.mem_no;
			var device_serial = res.device_serial;
			var device_name = res.device_name;
			var device_model = res.device_model;

			var query  = "SELECT COUNT(*) AS cnt FROM DEVICE WHERE mem_no in(SELECT mem_no FROM MEMBER WHERE mem_id = ? ) AND device_serial = ? ;";
			var isExist = false;
			fileServer.my_model = device_model;
			conn.query(query, [userId, device_serial], function(err, result, field){
				if(err){
					console.log("DEIVCE SELECT Error : ", err);
					isExist = false;
					res.isExist = isExist;
					io.sockets.in(fileServer.room).emit("power_on_device", res);
				}else{
					if(result[0]['cnt'] > 0){
						isExist = true;
						res.isExist = isExist;
						io.sockets.in(fileServer.room).emit("power_on_device", res);
					}else{
						console.log
						var insertQuery = "INSERT INTO DEVICE values(0, ?, ?, ?, ?)";
						conn.query(insertQuery, [device_model, device_name, device_serial, mem_no], function(error){
							if(error){
								console.log("DEVICE INSERT ERROR : ", error);
							}else{
								isExist = false;
								res.isExist = isExist;
								io.sockets.in(fileServer.room).emit("power_on_device", res);
							}
						});
					}
				}
				
			});
			
		});

		fileServer.on("device_login", function(data, ack){
			var query = 'SELECT * FROM MEMBER WHERE mem_id = ? ';
			var response = { isSuccess : true};

			console.log("data ", data.userId);

			// Query is Select User
			conn.query(query, [data.userId], function(err, result, field){
				if(err){
					console.log("Query Error : ", err);
					conn.release();
				}else{
					console.log("row : ", result);
					if(result.length > 0){
		  				var rs = result[0];

		  				// Check Password
		  				if(!hash.verify(data.userPwd, rs['mem_pwd'])){
		  					response.isSuccess = false;	
		  				}else{
		  					// Deivce User Register
		  					fileServer.room = data.userId;
		  					fileServer.mem_no = rs['mem_no'];
		  					// Join User Channel 
		  					fileServer.join(fileServer.room);
		  					response.isSuccess = true;	
		  				}
		  			}else{
		  				response.isSuccess = false;
		  			}
				}
				console.log("Login Response : ", response);
				// Ack device_login
				fileServer.emit("login_response", response);
			});
		});

		fileServer.on("logout_FileServer", function(data){
			io.sockets.in(fileServer.room).emit("power_off_device", {device_model : fileServer.my_model});
			fileServer.leave(fileServer.room);
			if(fileServer.device_channel == null || fileServer.device_channel == undefined	) return ;
			io.sockets.in(fileServer.device_channel).emit("power_off_device", {});
			fileServer.leave(fileServer.device_channel);
		});
		fileServer.on("ack_connect_device", function(data){
			console.log("Success Device Connect");
			fileServer.device_channel = data.member+data.device;
			fileServer.join(fileServer.device_channel);
			io.sockets.in(fileServer.device_channel	).emit("success_device_connect", data);
		});
		fileServer.on("res_file_tree", function(data){
			console.log("receive file tree : ");
			io.sockets.in(fileServer.device_channel).emit("file_tree", data);
		});

		fileServer.on("res_mkdir", function(data){
			manageResponse("res_create_forder", data);
		});
		fileServer.on("res_rename", function(data){
			console.log("res_reanme", data);
			manageResponse("res_rename_file", data);
		});
		fileServer.on("response_paste", function(data){
			console.log("res_paste", data);
			manageResponse("res_paste", data);
		});
		fileServer.on("res_rm", function(data){
			console.log("res remove");
			manageResponse("response_rm", data);
		});
		fileServer.on("res_copy", function(data){
			console.log("res copy");
			manageResponse("response_copy", data);
		});
		fileServer.on("res_upload", function(data){
			console.log("res_upload");
			manageResponse("response_upload", data);
		});

		fileServer.on("res_file_info", function(data){
			console.log("res_file_info", data);
			var key = data.key;
			console.log("res_file_info : key : ", key);
			// if(downloadMap.has(key)){
			// 	downloadMap.get(key).chunkList = new HashMap();
			// }else{
				console.log(key);
				var obj = {
					chunkList : new HashMap(),
					fileName : data.fileName,
					totalChunk : data.totalChunk
				};
				downloadMap.set(String(key), obj);
			// }
			// manageResponse("response_file_info", data);
		});

		fileServer.on("res_file_chunk", function(data){
			console.log("res_file_chunk");
			console.log("chunk:", data.idx);
			var key = data.key;
			var idx = data.idx;
			var chunk = data.chunk;
			var chunkList = downloadMap.get(String(key)).chunkList;
			var totalChunk = downloadMap.get(String(key)).totalChunk;
			var name =downloadMap.get(String(key)).fileName;
			console.log("chunk : ", chunk);
			
			
			chunkList.set(idx, chunk);
			
			if(chunkList.count() == totalChunk){
				console.log("Complete Receive");
				var buffer1 = new Uint8Array(chunkList.get(1));
				var buffer2;
				var binary = '';
				var bytes;
				// console.log(buffer1);
				var len = chunkList.count();
				for(var idx = 2; idx <= len; idx++){
					console.log(" sum : ", idx, buffer1.byteLength);
					var tmp;
					buffer2 = new Uint8Array(chunkList.get(idx));

					tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
					tmp.set(new Uint8Array(buffer1), 0);
					tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
					buffer1 = tmp.buffer;
					// console.log(buffer1);
				}

				var client_id = data.client_id;
				console.log("kts : ", client_id);
				var clientStream = streamSet.get(client_id);
				
				// console.log("stream", clientStream);
				var buffer = new Buffer(tmp.byteLength);
				for(var i = 0; i<tmp.byteLength; i++){
					buffer[i] = tmp[i];
				}
				// var buffer = buffer1.buffer;
				console.log("set : ", buffer);
				var bufferStream = new serverStream.PassThrough();
				bufferStream.end(buffer);
				bufferStream.pipe(clientStream);
			}
			// manageResponse("response_file_chunk", data);
		});
		fileServer.on("res_file", function(data){
			console.log("res_file");
			manageResponse("response_file", data);
		});
		
		function manageResponse(eventName, data){
		
			if(data.isComplete == null || data.isComplete == undefined){
				data.isComplete = false;
			}
			io.sockets.in(fileServer.device_channel).emit(eventName, data);
		}

	}
}
//
