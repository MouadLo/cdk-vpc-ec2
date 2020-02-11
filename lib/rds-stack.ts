import {App, Duration, Stack, StackProps} from "@aws-cdk/core";
import {DatabaseInstance, DatabaseInstanceEngine, StorageType} from '@aws-cdk/aws-rds';
import {ISecret, Secret} from '@aws-cdk/aws-secretsmanager';
import { InstanceClass, InstanceSize, InstanceType, Peer, SubnetType, Vpc } from "@aws-cdk/aws-ec2";

export interface RDSStackProps extends StackProps {
    vpc: Vpc;
}

export class RDSStack extends Stack {

    readonly secret: ISecret;
    readonly mySQLRDSInstance: DatabaseInstance;

    constructor(scope: App, id: string, props: RDSStackProps) {
        super(scope, id, props);

    this.secret = Secret.fromSecretAttributes(this, 'SamplePassword', {
        secretArn: 'arn:aws:secretsmanager:{region}:{organisation-id}:secret:ImportedSecret-sample',
    });
    
    this.mySQLRDSInstance = new DatabaseInstance(this, 'mysql-rds-instance', {
        engine: DatabaseInstanceEngine.MYSQL,
        instanceClass: InstanceType.of(InstanceClass.T2, InstanceSize.SMALL),
        vpc: props.vpc,
        vpcPlacement: {subnetType: SubnetType.ISOLATED},
        storageEncrypted: true,
        multiAz: false,
        autoMinorVersionUpgrade: false,
        allocatedStorage: 25,
        storageType: StorageType.GP2,
        backupRetention: Duration.days(3),
        deletionProtection: false,
        masterUsername: 'Admin',
        databaseName: 'Reporting',
        masterUserPassword: this.secret.secretValue,
        port: 3306
    });
    
    }
}